import SwiftUI
import AuthenticationServices

struct SignInView: View {
    @ObservedObject var viewModel: AuthViewModel

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "figure.run")
                .resizable()
                .frame(width: 96, height: 96)
                .foregroundStyle(FitVisionStyle.primary)
            Text("Welcome to FitVision")
                .font(.largeTitle)
                .bold()
            Text("Sign in to sync your plans, logs, and progress across devices.")
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
            SignInWithAppleButton(.signIn) { request in
                viewModel.signInWithApple()
            } onCompletion: { result in
                // Handled inside the view model coordinator
            }
            .frame(height: 50)
            .signInWithAppleButtonStyle(.black)
            .padding(.horizontal, 32)
            if case .loading = viewModel.state {
                ProgressView()
            }
            if case .error(let message) = viewModel.state {
                Text(message).foregroundColor(.red)
            }
            Spacer()
        }
        .padding()
        .background(FitVisionStyle.background.ignoresSafeArea())
    }
}
