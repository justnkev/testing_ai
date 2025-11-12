import SwiftUI
import Charts

struct DashboardView: View {
    @StateObject var viewModel: DashboardViewModel
    @EnvironmentObject private var environment: AppEnvironment

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Picker("Range", selection: $viewModel.selectedRange) {
                        ForEach(DashboardViewModel.RangeOption.allCases) { range in
                            Text(range.title).tag(range)
                        }
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: viewModel.selectedRange) { _ in
                        Task { await viewModel.load() }
                    }

                    if let stats = viewModel.stats {
                        DashboardStatsView(stats: stats)
                        if let trendlines = stats.trendlines {
                            ForEach(trendlines.keys.sorted(), id: \.self) { key in
                                if let values = trendlines[key] {
                                    Chart {
                                        ForEach(Array(values.enumerated()), id: \.offset) { index, value in
                                            LineMark(
                                                x: .value("Day", index),
                                                y: .value("Value", value)
                                            )
                                        }
                                    }
                                    .frame(height: 160)
                                    .padding()
                                    .background(Color(uiColor: .secondarySystemBackground))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                }
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
            .navigationTitle("Dashboard")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    NavigationLink(destination: SettingsView(viewModel: environment.makeSettingsViewModel())) {
                        Image(systemName: "gear")
                    }
                }
            }
            .refreshable { await viewModel.refresh() }
        }
        .task { await viewModel.load() }
    }
}

private struct DashboardStatsView: View {
    let stats: Stats

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
            StatTile(title: "Calories In", value: String(format: "%.0f", stats.caloriesIn))
            StatTile(title: "Calories Out", value: String(format: "%.0f", stats.caloriesOut))
            StatTile(title: "Steps", value: "\(stats.steps)")
            StatTile(title: "Sleep", value: String(format: "%.1f h", stats.sleepHours))
            StatTile(title: "Workouts", value: "\(stats.workoutsCount)")
            StatTile(title: "Habits", value: "\(stats.habitsCount)")
        }
    }
}

private struct StatTile: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading) {
            Text(title).font(.caption).foregroundColor(.secondary)
            Text(value).font(.title2).bold()
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
