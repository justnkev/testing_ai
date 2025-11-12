import SwiftUI

enum FitVisionStyle {
    static let primary = Color("Primary", bundle: .main)
    static let secondary = Color("Secondary", bundle: .main)
    static let background = Color(UIColor.systemBackground)
}

struct FitVisionButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding()
            .frame(maxWidth: .infinity)
            .background(configuration.isPressed ? FitVisionStyle.primary.opacity(0.7) : FitVisionStyle.primary)
            .foregroundColor(.white)
            .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
