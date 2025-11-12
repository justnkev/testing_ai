import Foundation
import SwiftUI

@MainActor
final class VisualizeViewModel: ObservableObject {
    @Published var prompt: String = ""
    @Published var selectedImageData: Data?
    @Published private(set) var visualizations: [Visualization] = []
    @Published var isGenerating = false
    @Published var error: String?

    private let container: DIContainer
    private let cache = ImageCache()

    init(container: DIContainer) {
        self.container = container
    }

    func load() async {
        do {
            visualizations = try await container.visualizationsRepository.fetch()
        } catch {
            self.error = "Failed to load visualizations"
        }
    }

    func generate() async {
        guard !prompt.isEmpty else { return }
        isGenerating = true
        defer { isGenerating = false }
        let request = VisualizationRequest(prompt: prompt, imageData: selectedImageData)
        do {
            let visualization = try await container.visualizationsRepository.create(request: request)
            visualizations.insert(visualization, at: 0)
            if let data = selectedImageData {
                cache.store(data: data, for: visualization.id)
            }
            prompt = ""
            selectedImageData = nil
        } catch {
            self.error = "Generation failed"
        }
    }

    func imageData(for visualization: Visualization) async -> Data? {
        if let cached = cache.data(for: visualization.id) {
            return cached
        }
        do {
            let (data, _) = try await URLSession.shared.data(from: visualization.url)
            cache.store(data: data, for: visualization.id)
            return data
        } catch {
            return nil
        }
    }
}
