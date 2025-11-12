import SwiftUI

struct SettingsView: View {
    @ObservedObject var viewModel: SettingsViewModel

    var body: some View {
        Form {
            Section(header: Text("Environment")) {
                Picker("API Environment", selection: $viewModel.environment) {
                    ForEach(SettingsViewModel.EnvironmentOption.allCases) { option in
                        Text(option.title).tag(option)
                    }
                }
                .onChange(of: viewModel.environment) { _ in
                    viewModel.applyEnvironment()
                }
            }

            Section(header: Text("Integrations")) {
                Toggle("Enable HealthKit", isOn: $viewModel.isHealthKitEnabled)
                    .onChange(of: viewModel.isHealthKitEnabled) { _ in
                        viewModel.toggleHealthKit()
                    }
            }

            Section {
                Button("Sign Out", role: .destructive) {
                    viewModel.signOut()
                }
            }

            Section(header: Text("Legal")) {
                Link("Privacy Policy", destination: URL(string: "https://fitvision.example/privacy")!)
                Link("Terms of Service", destination: URL(string: "https://fitvision.example/terms")!)
            }
        }
        .navigationTitle("Settings")
    }
}

final class SettingsViewModel: ObservableObject {
    enum EnvironmentOption: String, CaseIterable, Identifiable {
        case dev, staging, prod

        var id: String { rawValue }
        var title: String {
            switch self {
            case .dev: return "Development"
            case .staging: return "Staging"
            case .prod: return "Production"
            }
        }
    }

    @Published var environment: EnvironmentOption = SettingsViewModel.loadEnvironment()
    @Published var isHealthKitEnabled: Bool

    private let container: DIContainer
    private weak var delegate: SettingsViewModelDelegate?

    init(container: DIContainer, delegate: SettingsViewModelDelegate?) {
        self.container = container
        self.delegate = delegate
        self.isHealthKitEnabled = container.healthManager.isEnabled
        applyEnvironment()
    }

    func toggleHealthKit() {
        if isHealthKitEnabled {
            container.healthManager.requestAuthorization()
        } else {
            container.healthManager.disable()
        }
    }

    func applyEnvironment() {
        UserDefaults.standard.set(environment.rawValue, forKey: "AppEnvironment")
    }

    func signOut() {
        delegate?.signOutRequested()
    }

    static func loadEnvironment() -> EnvironmentOption {
        let value = UserDefaults.standard.string(forKey: "AppEnvironment")
        return EnvironmentOption(rawValue: value ?? EnvironmentOption.prod.rawValue) ?? .prod
    }
}
