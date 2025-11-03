package com.fitvision.speech

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.util.Locale

private const val PERMISSION_REQUEST_CODE = 9011

class FitVisionSpeechModule(
    private val activity: Activity,
    private val webView: WebView
) : RecognitionListener {

    private val handler = Handler(Looper.getMainLooper())
    private var speechRecognizer: SpeechRecognizer? = null
    private var recognitionIntent: Intent? = null
    private var currentTranscript = StringBuilder()
    private var pendingPermissionCallbackId: String? = null
    private var permissionCompletion: ((String) -> Unit)? = null

    fun attach() {
        ensureProxy()
    }

    fun detach() {
        speechRecognizer?.destroy()
        speechRecognizer = null
        pendingPermissionCallbackId = null
        permissionCompletion = null
    }

    fun handleRequest(message: JSONObject) {
        val action = message.optString("action")
        val callbackId = message.optString("callbackId")
        val payload = message.optJSONObject("payload") ?: JSONObject()

        when (action) {
            "requestPermission" -> {
                val rationale = payload.optString("rationale")
                requestPermission(callbackId, rationale)
            }
            "startListening" -> startListening(callbackId, payload)
            "stopListening" -> stopListening(callbackId)
            "cancelListening" -> cancelListening(callbackId)
            "openSettings" -> openSettings(callbackId)
            else -> resolveCallback(callbackId, null, "Unsupported command: $action")
        }
    }

    fun handlePermissionResult(granted: Boolean) {
        val callbackId = pendingPermissionCallbackId ?: return
        pendingPermissionCallbackId = null
        val status = if (granted) "granted" else "denied"
        permissionCompletion?.invoke(status)
        permissionCompletion = null
        resolveCallback(callbackId, JSONObject().put("status", status), null)
        emitEvent("permission", JSONObject().put("status", status).put("source", "android"))
    }

    fun reportBridgeError(message: String) {
        emitError("bridge", message)
    }

    private fun requestPermission(callbackId: String, rationale: String?) {
        val granted = ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (granted) {
            resolveCallback(callbackId, JSONObject().put("status", "granted"), null)
            emitEvent("permission", JSONObject().put("status", "granted").put("source", "android"))
            return
        }

        pendingPermissionCallbackId = callbackId
        permissionCompletion = { }
        ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.RECORD_AUDIO), PERMISSION_REQUEST_CODE)
    }

    private fun startListening(callbackId: String, payload: JSONObject) {
        if (!SpeechRecognizer.isRecognitionAvailable(activity)) {
            resolveCallback(callbackId, null, "Speech recognition not available")
            emitError("unsupported", "Speech recognition not available")
            return
        }

        if (speechRecognizer == null) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(activity).apply {
                setRecognitionListener(this@FitVisionSpeechModule)
            }
        }

        currentTranscript = StringBuilder()
        recognitionIntent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            val language = payload.optString("language", Locale.getDefault().toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        }

        emitEvent("state", JSONObject().put("status", "listening").put("source", "android"))
        speechRecognizer?.startListening(recognitionIntent)
        resolveCallback(callbackId, JSONObject().put("status", "listening"), null)
    }

    private fun stopListening(callbackId: String) {
        speechRecognizer?.let {
            it.stopListening()
            emitEvent("state", JSONObject().put("status", "processing").put("source", "android"))
        }
        resolveCallback(callbackId, JSONObject().put("status", "processing"), null)
    }

    private fun cancelListening(callbackId: String) {
        speechRecognizer?.cancel()
        emitEvent("state", JSONObject().put("status", "idle").put("source", "android"))
        emitEvent("cancel", JSONObject().put("reason", "user").put("source", "android"))
        resolveCallback(callbackId, JSONObject().put("status", "idle"), null)
    }

    private fun openSettings(callbackId: String) {
        val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:${activity.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        try {
            activity.startActivity(intent)
            resolveCallback(callbackId, JSONObject().put("opened", true), null)
        } catch (error: ActivityNotFoundException) {
            resolveCallback(callbackId, JSONObject().put("opened", false), error.message)
        }
    }

    private fun resolveCallback(callbackId: String?, payload: Any?, error: String?) {
        if (callbackId.isNullOrBlank()) return
        val payloadJson = payload?.let { if (it is JSONObject) it else JSONObject.wrap(it) } ?: JSONObject.NULL
        val errorJson = error?.let { JSONObject().put("message", it) } ?: JSONObject.NULL
        val script = "window.FitVisionSpeechBridge && window.FitVisionSpeechBridge._handleNativeCallback('" + callbackId + "', " + payloadJson.toString() + ", " + errorJson.toString() + ");"
        handler.post {
            webView.evaluateJavascript(script, null)
        }
    }

    private fun emitEvent(name: String, payload: JSONObject) {
        val script = "window.FitVisionSpeechBridge && window.FitVisionSpeechBridge._handleNativeEvent('" + name + "', " + payload.toString() + ");"
        handler.post {
            webView.evaluateJavascript(script, null)
        }
    }

    private fun emitError(code: String, message: String) {
        emitEvent("error", JSONObject().put("code", code).put("message", message).put("source", "android"))
    }

    private fun ensureProxy() {
        val script = """
            (function() {
              if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.FitVisionSpeech) { return; }
              window.webkit = window.webkit || {};
              window.webkit.messageHandlers = window.webkit.messageHandlers || {};
              window.webkit.messageHandlers.FitVisionSpeech = {
                postMessage: function(message) {
                  try {
                    if (typeof message === 'string') {
                      AndroidSpeechBridge.postMessage(message);
                    } else {
                      AndroidSpeechBridge.postMessage(JSON.stringify(message));
                    }
                  } catch (err) {
                    console.error('Speech bridge error', err);
                  }
                }
              };
            })();
        """.trimIndent()
        handler.post {
            webView.evaluateJavascript(script, null)
        }
    }

    override fun onReadyForSpeech(params: Bundle?) {}

    override fun onBeginningOfSpeech() {
        emitEvent("state", JSONObject().put("status", "listening").put("source", "android"))
    }

    override fun onRmsChanged(rmsdB: Float) {}

    override fun onBufferReceived(buffer: ByteArray?) {}

    override fun onEndOfSpeech() {}

    override fun onError(error: Int) {
        emitError("recognition", "Error code: $error")
        emitEvent("state", JSONObject().put("status", "idle").put("source", "android"))
    }

    override fun onResults(results: Bundle?) {
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: return
        val transcript = matches.joinToString(" ")
        currentTranscript.clear()
        currentTranscript.append(transcript)
        emitEvent(
            "transcript",
            JSONObject().put("text", transcript).put("isFinal", true).put("source", "android")
        )
        emitEvent("state", JSONObject().put("status", "idle").put("source", "android"))
    }

    override fun onPartialResults(partialResults: Bundle?) {
        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: return
        if (matches.isEmpty()) return
        val transcript = matches.joinToString(" ")
        emitEvent(
            "transcript",
            JSONObject().put("text", transcript).put("isFinal", false).put("source", "android")
        )
    }

    override fun onEvent(eventType: Int, params: Bundle?) {}
}

class FitVisionSpeechBridge(
    private val activity: Activity,
    private val webView: WebView
) {
    private val module = FitVisionSpeechModule(activity, webView)

    init {
        webView.addJavascriptInterface(AndroidSpeechInterface(), "AndroidSpeechBridge")
        module.attach()
    }

    fun detach() {
        module.detach()
        webView.removeJavascriptInterface("AndroidSpeechBridge")
    }

    fun onRequestPermissionsResult(grantResults: IntArray) {
        val granted = grantResults.isNotEmpty() && grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED
        module.handlePermissionResult(granted)
    }

    inner class AndroidSpeechInterface {
        @JavascriptInterface
        fun postMessage(messageJson: String) {
            try {
                val json = JSONObject(messageJson)
                module.handleRequest(json)
            } catch (error: Exception) {
                module.reportBridgeError(error.message ?: "Unable to parse speech message")
            }
        }
    }
}
