import Foundation
import HealthKit

final class HealthKitManager {
    private let healthStore = HKHealthStore()
    private let service: HealthUploadService
    private(set) var isEnabled: Bool = false
    private var observerQueries: [HKObserverQuery] = []

    init(service: HealthUploadService) {
        self.service = service
    }

    func requestAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let readTypes: Set = [
            HKObjectType.quantityType(forIdentifier: .stepCount)!,
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKObjectType.quantityType(forIdentifier: .dietaryEnergyConsumed)!,
            HKObjectType.quantityType(forIdentifier: .dietaryProtein)!,
            HKObjectType.quantityType(forIdentifier: .dietaryCarbohydrates)!,
            HKObjectType.quantityType(forIdentifier: .dietaryFatTotal)!,
            HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!,
            HKObjectType.quantityType(forIdentifier: .heartRate)!
        ]
        healthStore.requestAuthorization(toShare: [], read: readTypes) { success, error in
            DispatchQueue.main.async {
                self.isEnabled = success
                if success { self.setupObservers(for: readTypes) }
            }
        }
    }

    func disable() {
        observerQueries.forEach(healthStore.stop)
        observerQueries.removeAll()
        isEnabled = false
    }

    private func setupObservers(for types: Set<HKObjectType>) {
        observerQueries.forEach(healthStore.stop)
        observerQueries.removeAll()
        for type in types {
            guard let sampleType = type as? HKSampleType else { continue }
            let query = HKObserverQuery(sampleType: sampleType, predicate: nil) { [weak self] _, completion, error in
                Task { await self?.fetchSamples(for: sampleType) }
                completion()
            }
            healthStore.execute(query)
            observerQueries.append(query)
            Task { await fetchSamples(for: sampleType) }
        }
    }

    private func fetchSamples(for sampleType: HKSampleType) async {
        let predicate = HKQuery.predicateForSamples(withStart: Date().addingTimeInterval(-86400), end: Date(), options: [])
        let limit = HKObjectQueryNoLimit
        let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(sampleType: sampleType, predicate: predicate, limit: limit, sortDescriptors: [sortDescriptor]) { [weak self] _, samples, error in
            guard let self, let samples else { return }
            let payload = samples.compactMap { sample -> HealthSample? in
                let start = sample.startDate
                let end = sample.endDate
                if let quantitySample = sample as? HKQuantitySample {
                    let unit = self.unit(for: quantitySample.quantityType)
                    let value = quantitySample.quantity.doubleValue(for: unit)
                    return HealthSample(type: quantitySample.quantityType.identifier, value: value, unit: unit.unitString, startDate: start, endDate: end)
                }
                if let categorySample = sample as? HKCategorySample {
                    return HealthSample(type: categorySample.categoryType.identifier, value: Double(categorySample.value), unit: "count", startDate: start, endDate: end)
                }
                return nil
            }
            Task { await self.service.upload(samples: payload) }
        }
        healthStore.execute(query)
    }

    private func unit(for type: HKQuantityType) -> HKUnit {
        switch type.identifier {
        case HKQuantityTypeIdentifier.stepCount.rawValue:
            return HKUnit.count()
        case HKQuantityTypeIdentifier.activeEnergyBurned.rawValue,
            HKQuantityTypeIdentifier.dietaryEnergyConsumed.rawValue:
            return HKUnit.kilocalorie()
        case HKQuantityTypeIdentifier.heartRate.rawValue:
            return HKUnit.count().unitDivided(by: HKUnit.minute())
        case HKQuantityTypeIdentifier.dietaryProtein.rawValue,
            HKQuantityTypeIdentifier.dietaryCarbohydrates.rawValue,
            HKQuantityTypeIdentifier.dietaryFatTotal.rawValue:
            return HKUnit.gram()
        default:
            return HKUnit.count()
        }
    }
}
