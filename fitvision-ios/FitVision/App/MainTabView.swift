import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var environment: AppEnvironment
    @State private var showingOnboarding = false
    @State private var plan: Plan?
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false

    var body: some View {
        TabView {
            DashboardView(viewModel: environment.makeDashboardViewModel())
                .tabItem { Label("Dashboard", systemImage: "speedometer") }
            ProgressViewScreen(viewModel: environment.makeProgressViewModel())
                .tabItem { Label("Progress", systemImage: "chart.bar") }
            VisualizeView(viewModel: environment.makeVisualizeViewModel())
                .tabItem { Label("Visualize", systemImage: "sparkles") }
            PlanView(viewModel: environment.makePlanViewModel())
                .tabItem { Label("Plan", systemImage: "list.bullet") }
        }
        .onAppear {
            if !hasCompletedOnboarding {
                showingOnboarding = true
            }
        }
        .sheet(isPresented: $showingOnboarding) {
            NavigationView {
                OnboardingView(viewModel: environment.makeOnboardingViewModel()) { newPlan in
                    self.plan = newPlan
                    hasCompletedOnboarding = true
                    showingOnboarding = false
                }
                .navigationTitle("Onboarding")
                .toolbar {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button("Close") { showingOnboarding = false }
                    }
                }
            }
        }
    }
}
