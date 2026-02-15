import Foundation
import Speech
import AVFoundation
import WebKit
import UIKit

final class FitVisionSpeechModule: NSObject {
    static let shared = FitVisionSpeechModule()

    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let speechRecognizer = SFSpeechRecognizer()
    private weak var webView: WKWebView?

    func attach(to webView: WKWebView) {
        self.webView = webView
    }

    func requestPermission(rationale: String?, completion: @escaping (String) -> Void) {
        let audioSession = AVAudioSession.sharedInstance()
        audioSession.requestRecordPermission { [weak self] granted in
            SFSpeechRecognizer.requestAuthorization { status in
                let finalStatus: String
                switch status {
                case .authorized:
                    finalStatus = granted ? "granted" : "denied"
                case .denied, .restricted:
                    finalStatus = "denied"
                case .notDetermined:
                    finalStatus = granted ? "prompt" : "denied"
                @unknown default:
                    finalStatus = granted ? "granted" : "denied"
                }

                self?.emit(event: "permission", payload: [
                    "status": finalStatus,
                    "rationale": rationale ?? "",
                    "source": "ios",
                ])

                DispatchQueue.main.async {
                    completion(finalStatus)
                }
            }
        }
    }

    func startListening(options: [String: Any]?, completion: @escaping (Error?) -> Void) {
        stopRecognition(clearState: false)

        guard SFSpeechRecognizer.authorizationStatus() == .authorized else {
            let error = NSError(domain: "FitVisionSpeech", code: 1, userInfo: [NSLocalizedDescriptionKey: "Speech permission not granted."])
            emitError(code: "permission", message: error.localizedDescription)
            completion(error)
            return
        }

        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.record, mode: .measurement, options: [.duckOthers])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            emitError(code: "audio-session", message: error.localizedDescription)
            completion(error)
            return
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if let requireOnDevice = options?["requiresOnDevice"] as? Bool {
            request.requiresOnDeviceRecognition = requireOnDevice
        }

        recognitionRequest = request

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }

        audioEngine.prepare()

        do {
            try audioEngine.start()
        } catch {
            emitError(code: "audio-start", message: error.localizedDescription)
            completion(error)
            return
        }

        recognitionTask = speechRecognizer?.recognitionTask(with: request, resultHandler: { [weak self] result, error in
            guard let self = self else { return }

            if let result = result {
                let transcript = result.bestTranscription.formattedString
                self.emit(event: "transcript", payload: [
                    "text": transcript,
                    "isFinal": result.isFinal,
                    "source": "ios",
                ])

                if result.isFinal {
                    self.finishRecognition()
                }
            }

            if let error = error {
                self.emitError(code: "recognition", message: error.localizedDescription)
                self.finishRecognition()
            }
        })

        emit(event: "state", payload: ["status": "listening", "source": "ios"])
        completion(nil)
    }

    func stopListening(completion: @escaping (Error?) -> Void) {
        guard audioEngine.isRunning else {
            completion(nil)
            return
        }

        recognitionRequest?.endAudio()
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        emit(event: "state", payload: ["status": "processing", "source": "ios"])
        completion(nil)
    }

    func cancelListening(completion: @escaping () -> Void) {
        stopRecognition(clearState: true)
        emit(event: "cancel", payload: ["reason": "user", "source": "ios"])
        completion()
    }

    func openSettings(completion: @escaping (Bool) -> Void) {
        guard let settingsURL = URL(string: UIApplication.openSettingsURLString) else {
            completion(false)
            return
        }

        DispatchQueue.main.async {
            UIApplication.shared.open(settingsURL, options: [:]) { opened in
                completion(opened)
            }
        }
    }

    func resolveCallback(identifier: String, payload: Any? = nil, error: Error? = nil) {
        guard let webView = webView else { return }

        let payloadJSON = serializeToJSON(payload)
        let errorJSON: String
        if let error = error {
            errorJSON = serializeToJSON(["message": error.localizedDescription])
        } else {
            errorJSON = "null"
        }

        let script = "window.FitVisionSpeechBridge && window.FitVisionSpeechBridge._handleNativeCallback('\(identifier)', \(payloadJSON), \(errorJSON));"
        DispatchQueue.main.async {
            webView.evaluateJavaScript(script, completionHandler: nil)
        }
    }

    private func finishRecognition() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask?.cancel()
        recognitionTask = nil
        emit(event: "state", payload: ["status": "idle", "source": "ios"])
    }

    private func stopRecognition(clearState: Bool) {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask?.cancel()
        recognitionTask = nil

        if clearState {
            emit(event: "state", payload: ["status": "idle", "source": "ios"])
        }
    }

    private func emit(event name: String, payload: [String: Any]) {
        guard let webView = webView else { return }
        let json = serializeToJSON(payload)
        let script = "window.FitVisionSpeechBridge && window.FitVisionSpeechBridge._handleNativeEvent('\(name)', \(json));"
        DispatchQueue.main.async {
            webView.evaluateJavaScript(script, completionHandler: nil)
        }
    }

    private func emitError(code: String, message: String) {
        emit(event: "error", payload: [
            "code": code,
            "message": message,
            "source": "ios",
        ])
    }

    private func serializeToJSON(_ value: Any?) -> String {
        guard let value = value else { return "null" }

        if let boolValue = value as? Bool {
            return boolValue ? "true" : "false"
        }

        if let number = value as? NSNumber {
            return number.stringValue
        }

        if let string = value as? String {
            let escaped = string
                .replacingOccurrences(of: "\", with: "\\")
                .replacingOccurrences(of: "\"", with: "\\\"")
                .replacingOccurrences(of: "\n", with: "\\n")
                .replacingOccurrences(of: "\r", with: "\\r")
            return "\"\(escaped)\""
        }

        if JSONSerialization.isValidJSONObject(value) {
            if let data = try? JSONSerialization.data(withJSONObject: value, options: []),
               let json = String(data: data, encoding: .utf8) {
                return json
            }
        }

        return "null"
    }
}

final class FitVisionSpeechBridge: NSObject, WKScriptMessageHandler {
    static let handlerName = "FitVisionSpeech"

    private let module: FitVisionSpeechModule

    init(module: FitVisionSpeechModule = .shared) {
        self.module = module
    }

    func install(on webView: WKWebView) {
        module.attach(to: webView)
        webView.configuration.userContentController.add(self, name: Self.handlerName)
    }

    func uninstall(from webView: WKWebView) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: Self.handlerName)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String,
              let callbackId = body["callbackId"] as? String else {
            return
        }

        let payload = body["payload"] as? [String: Any]

        switch action {
        case "requestPermission":
            let rationale = payload?["rationale"] as? String
            module.requestPermission(rationale: rationale) { [weak module] status in
                module?.resolveCallback(identifier: callbackId, payload: ["status": status], error: nil)
            }
        case "startListening":
            module.startListening(options: payload) { [weak module] error in
                module?.resolveCallback(identifier: callbackId, payload: ["status": error == nil ? "listening" : "error"], error: error)
            }
        case "stopListening":
            module.stopListening { [weak module] error in
                module?.resolveCallback(identifier: callbackId, payload: ["status": "processing"], error: error)
            }
        case "cancelListening":
            module.cancelListening { [weak module] in
                module?.resolveCallback(identifier: callbackId, payload: ["status": "idle"], error: nil)
            }
        case "openSettings":
            module.openSettings { [weak module] opened in
                module?.resolveCallback(identifier: callbackId, payload: ["opened": opened], error: nil)
            }
        default:
            let error = NSError(domain: "FitVisionSpeech", code: 99, userInfo: [NSLocalizedDescriptionKey: "Unsupported command."])
            module.resolveCallback(identifier: callbackId, payload: nil, error: error)
        }
    }
}
