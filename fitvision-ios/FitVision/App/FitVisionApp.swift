import SwiftUI
import BackgroundTasks

@main
struct FitVisionApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var environment = AppEnvironment()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(environment)
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        BackgroundTaskRegistrar.registerTasks()
        return true
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        BackgroundTaskRegistrar.scheduleAppRefresh()
    }
}

private struct RootView: View {
    @EnvironmentObject private var environment: AppEnvironment

    var body: some View {
        Group {
            if environment.session.isAuthenticated {
                MainTabView()
            } else {
                SignInView(viewModel: environment.makeAuthViewModel())
            }
        }
        .task {
            await environment.bootstrap()
        }
    }
}
