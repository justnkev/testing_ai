import Foundation

final class ImageCache {
    private let fileManager = FileManager.default
    private lazy var directoryURL: URL = {
        let url = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("visualizations", isDirectory: true)
        if !fileManager.fileExists(atPath: url.path) {
            try? fileManager.createDirectory(at: url, withIntermediateDirectories: true)
        }
        return url
    }()

    func store(data: Data, for id: UUID) {
        let fileURL = directoryURL.appendingPathComponent(id.uuidString).appendingPathExtension("jpg")
        try? data.write(to: fileURL)
    }

    func data(for id: UUID) -> Data? {
        let fileURL = directoryURL.appendingPathComponent(id.uuidString).appendingPathExtension("jpg")
        return try? Data(contentsOf: fileURL)
    }
}
