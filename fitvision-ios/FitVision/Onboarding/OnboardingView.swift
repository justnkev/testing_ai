import SwiftUI

struct OnboardingView: View {
    @StateObject var viewModel: OnboardingViewModel
    var onComplete: (Plan) -> Void

    var body: some View {
        VStack {
            TabView(selection: $viewModel.step) {
                activityStep.tag(OnboardingViewModel.Step.activity)
                sleepStep.tag(OnboardingViewModel.Step.sleep)
                lifestyleStep.tag(OnboardingViewModel.Step.lifestyle)
            }
            .tabViewStyle(PageTabViewStyle(indexDisplayMode: .always))
            .animation(.easeInOut, value: viewModel.step)
            HStack {
                if viewModel.step != .activity {
                    Button("Back") { viewModel.back() }
                        .buttonStyle(.bordered)
                }
                Spacer()
                if viewModel.step == .lifestyle {
                    Button("Finish") {
                        Task {
                            if let plan = await viewModel.submit() {
                                onComplete(plan)
                            }
                        }
                    }
                    .buttonStyle(FitVisionButtonStyle())
                    .disabled(viewModel.isSubmitting)
                } else {
                    Button("Next") { viewModel.next() }
                        .buttonStyle(FitVisionButtonStyle())
                }
            }
            .padding()
            if let error = viewModel.error {
                Text(error).foregroundColor(.red)
            }
            if viewModel.isSubmitting {
                LoadingView()
            }
        }
        .padding()
    }

    private var activityStep: some View {
        VStack(spacing: 16) {
            Text("How active are you?").font(.title).bold()
            Picker("Activity", selection: $viewModel.activityLevel) {
                Text("Low").tag("Low")
                Text("Moderate").tag("Moderate")
                Text("High").tag("High")
            }
            .pickerStyle(.segmented)
        }
        .padding()
    }

    private var sleepStep: some View {
        VStack(spacing: 16) {
            Text("How many hours do you sleep?").font(.title2)
            Slider(value: $viewModel.sleepHours, in: 4...10, step: 0.5)
            Text("\(viewModel.sleepHours, specifier: "%.1f") hours")
        }
        .padding()
    }

    private var lifestyleStep: some View {
        VStack(spacing: 16) {
            Text("Describe your lifestyle").font(.title2)
            TextField("e.g. Desk job, weekend warrior", text: $viewModel.lifestyle)
                .textFieldStyle(.roundedBorder)
        }
        .padding()
    }
}
