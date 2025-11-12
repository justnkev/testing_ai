import SwiftUI

struct VisualizeView: View {
    @StateObject var viewModel: VisualizeViewModel
    @State private var showingImagePicker = false

    var body: some View {
        VStack(spacing: 16) {
            TextField("Describe your future self", text: $viewModel.prompt, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(3, reservesSpace: true)
            if let data = viewModel.selectedImageData, let image = UIImage(data: data) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(height: 200)
                    .cornerRadius(12)
            }
            HStack {
                Button("Choose Photo") { showingImagePicker = true }
                Spacer()
                Button("Generate") {
                    Task { await viewModel.generate() }
                }
                .buttonStyle(FitVisionButtonStyle())
                .disabled(viewModel.isGenerating)
            }
            if viewModel.isGenerating { LoadingView() }
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 16)], spacing: 16) {
                    ForEach(viewModel.visualizations) { visualization in
                        VisualizationTile(visualization: visualization, loader: viewModel)
                    }
                }
                .padding(.vertical)
            }
        }
        .padding()
        .task { await viewModel.load() }
        .sheet(isPresented: $showingImagePicker) {
            ImagePicker(data: $viewModel.selectedImageData)
        }
        .alert("Error", isPresented: Binding(
            get: { viewModel.error != nil },
            set: { if !$0 { viewModel.error = nil } }
        )) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(viewModel.error ?? "Unknown error")
        }
    }
}

private struct VisualizationTile: View {
    let visualization: Visualization
    @ObservedObject var loader: VisualizeViewModel
    @State private var image: UIImage?

    var body: some View {
        VStack(alignment: .leading) {
            Group {
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                } else {
                    Rectangle()
                        .fill(Color.gray.opacity(0.2))
                        .overlay(ProgressView())
                }
            }
            .frame(height: 150)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            Text(visualization.createdAt.formatted(date: .abbreviated, time: .shortened))
                .font(.caption)
        }
        .task {
            if let data = await loader.imageData(for: visualization) {
                image = UIImage(data: data)
            }
        }
    }
}

private struct ImagePicker: UIViewControllerRepresentable {
    @Binding var data: Data?

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(data: $data)
    }

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        @Binding var data: Data?

        init(data: Binding<Data?>) {
            self._data = data
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            picker.dismiss(animated: true)
            if let image = info[.originalImage] as? UIImage, let jpeg = image.jpegData(compressionQuality: 0.9) {
                data = jpeg
            }
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            picker.dismiss(animated: true)
        }
    }
}
