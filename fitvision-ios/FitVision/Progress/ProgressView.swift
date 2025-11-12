import SwiftUI

struct ProgressViewScreen: View {
    @StateObject var viewModel: ProgressViewModel

    var body: some View {
        VStack {
            Form {
                Section(header: Text("Log Type")) {
                    Picker("Type", selection: $viewModel.form.type) {
                        ForEach(LogEntryType.allCases, id: \.self) { type in
                            Text(type.rawValue.capitalized).tag(type)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section(header: Text("Details")) {
                    TextField("Title", text: Binding(
                        get: { viewModel.form.fields["title", default: ""] },
                        set: { viewModel.form.fields["title"] = $0 }
                    ))
                    TextField("Notes", text: Binding(
                        get: { viewModel.form.fields["notes", default: ""] },
                        set: { viewModel.form.fields["notes"] = $0 }
                    ))
                }

                Button(action: {
                    Task { await viewModel.submit() }
                }) {
                    if viewModel.isSubmitting {
                        ProgressView()
                    } else {
                        Text("Save Log")
                            .frame(maxWidth: .infinity)
                    }
                }
            }

            List {
                ForEach(viewModel.logs) { log in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(log.type.rawValue.capitalized).font(.headline)
                        Text(log.timestamp.formatted())
                            .font(.caption)
                            .foregroundColor(.secondary)
                        ForEach(log.fields.sorted(by: { $0.key < $1.key }), id: \.key) { key, value in
                            Text("\(key.capitalized): \(value)")
                                .font(.subheadline)
                        }
                        if let calories = log.calories {
                            Text("Calories: \(calories, specifier: "%.0f")")
                                .font(.subheadline)
                        }
                    }
                }
                if viewModel.logs.count > 0 {
                    Button("Load more") {
                        Task { await viewModel.loadMore() }
                    }
                }
            }
        }
        .task { await viewModel.loadInitial() }
        .alert(isPresented: Binding<Bool>(
            get: { viewModel.error != nil },
            set: { if !$0 { viewModel.error = nil } }
        )) {
            Alert(title: Text("Error"), message: Text(viewModel.error ?? "Unknown"), dismissButton: .default(Text("OK")))
        }
    }
}
