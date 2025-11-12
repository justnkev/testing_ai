import Foundation

enum APIError: Error {
    case invalidURL
    case decoding(Error)
    case network(Error)
    case unauthorized
    case server(String)
}

protocol APITarget {
    var path: String { get }
    var method: String { get }
    var queryItems: [URLQueryItem]? { get }
    var body: Data? { get }
    var headers: [String: String] { get }
}

class APIClient {
    private let configuration: EnvironmentConfiguration
    private let sessionState: SessionState
    private let urlSession: URLSession

    init(configuration: EnvironmentConfiguration, session: SessionState, urlSession: URLSession = .shared) {
        self.configuration = configuration
        self.sessionState = session
        self.urlSession = urlSession
    }

    func send<T: Decodable>(_ target: APITarget, decode type: T.Type) async throws -> T {
        let request = try makeRequest(for: target)
        let (data, response) = try await urlSession.data(for: request)
        try validate(response: response, data: data)
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    func send(_ target: APITarget) async throws {
        let request = try makeRequest(for: target)
        let (data, response) = try await urlSession.data(for: request)
        try validate(response: response, data: data)
    }

    private func makeRequest(for target: APITarget) throws -> URLRequest {
        guard var components = URLComponents(url: configuration.baseURL.appendingPathComponent(target.path), resolvingAgainstBaseURL: false) else {
            throw APIError.invalidURL
        }
        components.queryItems = target.queryItems
        guard let url = components.url else { throw APIError.invalidURL }
        var request = URLRequest(url: url)
        request.httpMethod = target.method
        request.httpBody = target.body
        var headers = target.headers
        headers["Content-Type"] = headers["Content-Type"] ?? "application/json"
        if let jwt = sessionState.jwt {
            headers["Authorization"] = "Bearer \(jwt)"
        }
        request.allHTTPHeaderFields = headers
        return request
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw APIError.network(URLError(.badServerResponse))
        }
        switch http.statusCode {
        case 200..<300:
            return
        case 401:
            throw APIError.unauthorized
        default:
            let message = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw APIError.server(message)
        }
    }
}
