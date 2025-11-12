import AuthenticationServices
import SwiftUI

protocol AppleSignInCoordinatorDelegate: AnyObject {
    func coordinator(_ coordinator: AppleSignInCoordinator, didCompleteWith identityToken: String)
    func coordinator(_ coordinator: AppleSignInCoordinator, didFailWith error: Error)
}

final class AppleSignInCoordinator: NSObject {
    weak var delegate: AppleSignInCoordinatorDelegate?
}

extension AppleSignInCoordinator: ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        UIApplication.shared.windows.first { $0.isKeyWindow } ?? UIWindow()
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8) else {
            delegate?.coordinator(self, didFailWith: NSError(domain: "com.fitvision.app", code: -1))
            return
        }
        delegate?.coordinator(self, didCompleteWith: token)
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        delegate?.coordinator(self, didFailWith: error)
    }

    func signIn() {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }
}
