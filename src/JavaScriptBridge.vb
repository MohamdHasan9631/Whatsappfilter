Imports Microsoft.Web.WebView2.Core
Imports Microsoft.Web.WebView2.WinForms
Imports Newtonsoft.Json
Imports System.Threading.Tasks

''' <summary>
''' Bridge class for communication between VB.NET and JavaScript in WebView2
''' </summary>
Public Class JavaScriptBridge
    Private ReadOnly _webView As WebView2
    Private ReadOnly _parentSession As WASession

    Public Sub New(webView As WebView2, parentSession As WASession)
        _webView = webView
        _parentSession = parentSession
    End Sub

    ''' <summary>
    ''' Initialize the JavaScript bridge and inject helper functions
    ''' </summary>
    Public Async Function InitializeAsync() As Task
        Try
            ' Inject VB.NET bridge object into JavaScript
            Await _webView.CoreWebView2.AddHostObjectToScriptAsync("vbnetBridge", Me)

            ' Inject helper JavaScript functions for VB.NET communication
            Dim bridgeScript As String = "
                // VB.NET Bridge Helper Functions
                window.vbnetHelper = {
                    // Send data to VB.NET
                    sendToVBNet: function(eventType, data) {
                        if (window.vbnetBridge) {
                            window.vbnetBridge.ReceiveFromJavaScript(eventType, JSON.stringify(data));
                        }
                    },
                    
                    // Enhanced login detection function
                    isUserLoggedIn: function() {
                        try {
                            // Multiple checks for login state
                            const checks = [
                                // Check for QR code presence (not logged in)
                                () => document.querySelector('[data-testid=""qr-code""]') === null,
                                
                                // Check for main chat interface
                                () => document.querySelector('[data-testid=""chat-list""]') !== null,
                                
                                // Check for side panel
                                () => document.querySelector('#side') !== null,
                                
                                // Check for app wrapper with logged-in state
                                () => {
                                    const app = document.querySelector('#app');
                                    return app && !app.querySelector('[data-testid=""qr-code""]');
                                },
                                
                                // Check for user avatar in header
                                () => document.querySelector('[data-testid=""avatar""]') !== null
                            ];
                            
                            // At least 2 checks must pass for confident login detection
                            const passedChecks = checks.filter(check => {
                                try {
                                    return check();
                                } catch {
                                    return false;
                                }
                            }).length;
                            
                            const isLoggedIn = passedChecks >= 2;
                            
                            // Send result to VB.NET
                            this.sendToVBNet('loginStatusChanged', {
                                isLoggedIn: isLoggedIn,
                                passedChecks: passedChecks,
                                timestamp: new Date().toISOString()
                            });
                            
                            return isLoggedIn;
                        } catch (error) {
                            console.error('Error checking login status:', error);
                            this.sendToVBNet('loginCheckError', {
                                error: error.message,
                                timestamp: new Date().toISOString()
                            });
                            return false;
                        }
                    },
                    
                    // Monitor for login state changes
                    startLoginMonitoring: function() {
                        let lastLoginState = null;
                        
                        const checkInterval = setInterval(() => {
                            const currentState = this.isUserLoggedIn();
                            if (currentState !== lastLoginState) {
                                lastLoginState = currentState;
                                this.sendToVBNet('loginStateChanged', {
                                    isLoggedIn: currentState,
                                    timestamp: new Date().toISOString()
                                });
                            }
                        }, 3000); // Check every 3 seconds
                        
                        // Store interval ID for cleanup
                        window.loginMonitorInterval = checkInterval;
                        
                        return checkInterval;
                    },
                    
                    // Stop login monitoring
                    stopLoginMonitoring: function() {
                        if (window.loginMonitorInterval) {
                            clearInterval(window.loginMonitorInterval);
                            window.loginMonitorInterval = null;
                        }
                    },
                    
                    // Get current page info
                    getPageInfo: function() {
                        const info = {
                            url: window.location.href,
                            title: document.title,
                            hasQR: document.querySelector('[data-testid=""qr-code""]') !== null,
                            hasChatList: document.querySelector('[data-testid=""chat-list""]') !== null,
                            timestamp: new Date().toISOString()
                        };
                        
                        this.sendToVBNet('pageInfo', info);
                        return info;
                    },
                    
                    // Handle incoming messages from backend
                    handleBackendMessage: function(message) {
                        this.sendToVBNet('backendMessage', message);
                    }
                };
                
                // Auto-start login monitoring when page loads
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => {
                        setTimeout(() => window.vbnetHelper.startLoginMonitoring(), 2000);
                    });
                } else {
                    setTimeout(() => window.vbnetHelper.startLoginMonitoring(), 2000);
                }
                
                // Override console.log to capture JavaScript logs in VB.NET
                const originalConsoleLog = console.log;
                console.log = function(...args) {
                    originalConsoleLog.apply(console, args);
                    if (window.vbnetHelper) {
                        window.vbnetHelper.sendToVBNet('consoleLog', {
                            message: args.join(' '),
                            timestamp: new Date().toISOString()
                        });
                    }
                };
                
                console.log('VB.NET JavaScript bridge initialized successfully');
            "

            Await _webView.CoreWebView2.ExecuteScriptAsync(bridgeScript)

        Catch ex As Exception
            Throw New Exception($"Failed to initialize JavaScript bridge: {ex.Message}", ex)
        End Try
    End Function

    ''' <summary>
    ''' Receive messages from JavaScript
    ''' </summary>
    ''' <param name="eventType">Type of event</param>
    ''' <param name="dataJson">JSON data from JavaScript</param>
    Public Sub ReceiveFromJavaScript(eventType As String, dataJson As String)
        Try
            Select Case eventType.ToLower()
                Case "loginstatuschanged", "loginstatechanged"
                    Dim loginData = JsonConvert.DeserializeObject(Of Dictionary(Of String, Object))(dataJson)
                    Dim isLoggedIn As Boolean = Boolean.Parse(loginData("isLoggedIn").ToString())
                    _parentSession.OnLoginStatusChanged(isLoggedIn)

                Case "loginchheckerror"
                    Dim errorData = JsonConvert.DeserializeObject(Of Dictionary(Of String, Object))(dataJson)
                    _parentSession.OnLoginCheckError(errorData("error").ToString())

                Case "pageinfo"
                    Dim pageData = JsonConvert.DeserializeObject(Of Dictionary(Of String, Object))(dataJson)
                    _parentSession.OnPageInfoReceived(pageData)

                Case "backendmessage"
                    Dim messageData = JsonConvert.DeserializeObject(Of Dictionary(Of String, Object))(dataJson)
                    _parentSession.OnBackendMessageReceived(messageData)

                Case "consolelog"
                    Dim logData = JsonConvert.DeserializeObject(Of Dictionary(Of String, Object))(dataJson)
                    _parentSession.OnJavaScriptLog(logData("message").ToString())

                Case Else
                    _parentSession.OnGenericMessage(eventType, dataJson)
            End Select

        Catch ex As Exception
            _parentSession.OnBridgeError($"Error processing JavaScript message: {ex.Message}")
        End Try
    End Sub

    ''' <summary>
    ''' Send a message to JavaScript
    ''' </summary>
    ''' <param name="functionName">JavaScript function to call</param>
    ''' <param name="parameters">Parameters to pass</param>
    Public Async Function SendToJavaScriptAsync(functionName As String, ParamArray parameters() As Object) As Task(Of String)
        Try
            Dim script As String
            If parameters IsNot Nothing AndAlso parameters.Length > 0 Then
                Dim paramJson = JsonConvert.SerializeObject(parameters)
                script = $"window.vbnetHelper.{functionName}(...{paramJson})"
            Else
                script = $"window.vbnetHelper.{functionName}()"
            End If

            Return Await _webView.CoreWebView2.ExecuteScriptAsync(script)
        Catch ex As Exception
            Throw New Exception($"Failed to send message to JavaScript: {ex.Message}", ex)
        End Try
    End Function

    ''' <summary>
    ''' Check login status using enhanced detection
    ''' </summary>
    Public Async Function CheckLoginStatusAsync() As Task(Of Boolean)
        Try
            Dim result = Await SendToJavaScriptAsync("isUserLoggedIn")
            Return Boolean.Parse(result.Trim('"'))
        Catch
            Return False
        End Try
    End Function

    ''' <summary>
    ''' Get current page information
    ''' </summary>
    Public Async Function GetPageInfoAsync() As Task
        Await SendToJavaScriptAsync("getPageInfo")
    End Function

    ''' <summary>
    ''' Start monitoring login state changes
    ''' </summary>
    Public Async Function StartLoginMonitoringAsync() As Task
        Await SendToJavaScriptAsync("startLoginMonitoring")
    End Function

    ''' <summary>
    ''' Stop monitoring login state changes
    ''' </summary>
    Public Async Function StopLoginMonitoringAsync() As Task
        Await SendToJavaScriptAsync("stopLoginMonitoring")
    End Function
End Class