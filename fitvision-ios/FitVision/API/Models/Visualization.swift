import Foundation

struct Visualization: Codable, Identifiable {
    let id: UUID
    let url: URL
    let createdAt: Date
    let notes: String?
}

struct VisualizationRequest {
    let prompt: String
    let imageData: Data?
    private let boundary = UUID().uuidString
}

extension VisualizationRequest {
    func encode() -> Data? {
        if let imageData {
            var data = Data()
            data.append("--\(boundary)\r\n".data(using: .utf8)!)
            data.append("Content-Disposition: form-data; name=\"prompt\"\r\n\r\n".data(using: .utf8)!)
            data.append(prompt.data(using: .utf8)!)
            data.append("\r\n--\(boundary)\r\n".data(using: .utf8)!)
            data.append("Content-Disposition: form-data; name=\"image\"; filename=\"photo.jpg\"\r\n".data(using: .utf8)!)
            data.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
            data.append(imageData)
            data.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
            return data
        } else {
            return try? JSONEncoder().encode(["prompt": prompt])
        }
    }

    var headers: [String: String] {
        if imageData != nil {
            return ["Content-Type": "multipart/form-data; boundary=\(boundary)"]
        } else {
            return [:]
        }
    }
}
