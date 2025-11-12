import SwiftUI

struct PlanView: View {
    @StateObject var viewModel: PlanViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let plan = viewModel.plan {
                    Text(plan.title).font(.largeTitle).bold()
                    Text(plan.summary)
                    Divider()
                    Text("Recommendations")
                        .font(.title3)
                        .bold()
                    ForEach(plan.recommendations, id: \.self) { recommendation in
                        HStack(alignment: .top) {
                            Image(systemName: "checkmark.circle.fill").foregroundColor(FitVisionStyle.primary)
                            Text(recommendation)
                        }
                    }
                } else if viewModel.isLoading {
                    LoadingView()
                } else if let error = viewModel.error {
                    Text(error).foregroundColor(.red)
                }
            }
            .padding()
        }
        .background(FitVisionStyle.background)
        .task {
            await viewModel.load()
        }
    }
}
