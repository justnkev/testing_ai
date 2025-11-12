import Foundation

struct EnvironmentConfiguration {
    let baseURL: URL
    let enableSSLPinning: Bool
}

enum EnvironmentConfigurationLoader {
    static func load() -> EnvironmentConfiguration {
        let bundle = Bundle.main
        var baseURLString = bundle.object(forInfoDictionaryKey: "BASE_URL") as? String ?? "https://api.fitvision.example"
        let enablePinning = (bundle.object(forInfoDictionaryKey: "ENABLE_SSL_PINNING") as? NSString)?.boolValue ?? false
        if let override = UserDefaults.standard.string(forKey: "AppEnvironment") {
            switch override {
            case "dev":
                baseURLString = "https://dev.api.fitvision.example"
            case "staging":
                baseURLString = "https://staging.api.fitvision.example"
            default:
                baseURLString = "https://api.fitvision.example"
            }
        }
        return EnvironmentConfiguration(baseURL: URL(string: baseURLString)!, enableSSLPinning: enablePinning)
    }
}

final class DIContainer {
    let apiClient: APIClient
    let coreDataStack: CoreDataStack
    let keychain: KeychainStorage
    let configuration: EnvironmentConfiguration

    lazy var userRepository = UserRepository(apiClient: apiClient, coreDataStack: coreDataStack)
    lazy var logsRepository = LogsRepository(apiClient: apiClient, coreDataStack: coreDataStack)
    lazy var visualizationsRepository = VisualizationsRepository(apiClient: apiClient, coreDataStack: coreDataStack)
    lazy var healthRepository = HealthRepository(apiClient: apiClient, coreDataStack: coreDataStack)
    lazy var healthManager = HealthKitManager(service: HealthUploadService(apiClient: apiClient))

    init(apiClient: APIClient, coreDataStack: CoreDataStack, keychain: KeychainStorage, configuration: EnvironmentConfiguration) {
        self.apiClient = apiClient
        self.coreDataStack = coreDataStack
        self.keychain = keychain
        self.configuration = configuration
        coreDataStack.apiClient = apiClient
    }
}

final class SessionState: ObservableObject {
    @Published private(set) var jwt: String?

    init(jwt: String?) {
        self.jwt = jwt
    }

    var isAuthenticated: Bool {
        jwt != nil
    }

    func update(jwt: String?) {
        self.jwt = jwt
    }
}

protocol SettingsViewModelDelegate: AnyObject {
    func signOutRequested()
}

enum BackgroundTaskRegistrar {
    static let appRefreshTaskIdentifier = "com.fitvision.app.refresh"

    static func registerTasks() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: appRefreshTaskIdentifier, using: nil) { task in
            guard let refreshTask = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            Task {
                await BackgroundSyncCoordinator.shared.performBackgroundRefresh()
                refreshTask.setTaskCompleted(success: true)
            }
        }
    }

    static func scheduleAppRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: appRefreshTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("Failed to schedule app refresh: \(error)")
        }
    }
}
