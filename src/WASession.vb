Imports Microsoft.Web.WebView2.Core
Imports Microsoft.Web.WebView2.WinForms
Imports Newtonsoft.Json
Imports System.IO
Imports System.Threading.Tasks

''' <summary>
''' WASession class that extends WebView2 with WhatsApp functionality
''' Provides a wrapper around the existing JavaScript WhatsApp integration
''' </summary>
Public Class WASession
    Inherits WebView2

    ' Events for communication with parent form
    Public Event LoginStatusChanged(isLoggedIn As Boolean)
    Public Event LoginCheckError(errorMessage As String)
    Public Event PageInfoReceived(pageInfo As Dictionary(Of String, Object))
    Public Event BackendMessageReceived(message As Dictionary(Of String, Object))
    Public Event JavaScriptLogReceived(message As String)
    Public Event WhatsAppCheckCompleted(result As WhatsAppCheckResult)
    Public Event BridgeError(errorMessage As String)
    Public Event GenericMessage(eventType As String, data As String)

    ' Private fields
    Private _jsBridge As JavaScriptBridge
    Private _isInitialized As Boolean = False
    Private _currentLoginStatus As Boolean = False
    Private _serverUrl As String = "http://localhost:3000"

    ''' <summary>
    ''' Constructor
    ''' </summary>
    Public Sub New()
        MyBase.New()
        InitializeComponent()
    End Sub

    ''' <summary>
    ''' Get or set the server URL for the WhatsApp backend
    ''' </summary>
    Public Property ServerUrl As String
        Get
            Return _serverUrl
        End Get
        Set(value As String)
            _serverUrl = value
        End Set
    End Property

    ''' <summary>
    ''' Get current login status
    ''' </summary>
    Public ReadOnly Property IsLoggedIn As Boolean
        Get
            Return _currentLoginStatus
        End Get
    End Property

    ''' <summary>
    ''' Initialize the WASession
    ''' </summary>
    Public Async Function InitializeAsync() As Task
        Try
            ' Ensure WebView2 is initialized
            If CoreWebView2 Is Nothing Then
                Await EnsureCoreWebView2Async()
            End If

            ' Create JavaScript bridge
            _jsBridge = New JavaScriptBridge(Me, Me)

            ' Set up WebView2 event handlers
            AddHandler CoreWebView2.NavigationCompleted, AddressOf OnNavigationCompleted
            AddHandler CoreWebView2.DOMContentLoaded, AddressOf OnDOMContentLoaded
            AddHandler CoreWebView2.DocumentTitleChanged, AddressOf OnDocumentTitleChanged

            ' Navigate to the WhatsApp interface
            CoreWebView2.Navigate(_serverUrl)

            _isInitialized = True

        Catch ex As Exception
            Throw New Exception($"Failed to initialize WASession: {ex.Message}", ex)
        End Try
    End Function

    ''' <summary>
    ''' Check if a phone number has WhatsApp
    ''' </summary>
    ''' <param name="phoneNumber">Phone number to check</param>
    ''' <returns>WhatsApp check result</returns>
    Public Async Function CheckWhatsAppAsync(phoneNumber As String) As Task(Of WhatsAppCheckResult)
        Try
            If Not _isInitialized Then
                Throw New InvalidOperationException("WASession is not initialized. Call InitializeAsync first.")
            End If

            If Not _currentLoginStatus Then
                Throw New InvalidOperationException("Not logged in to WhatsApp. Please scan QR code first.")
            End If

            ' Execute JavaScript to check the number
            Dim script As String = $"
                (async function() {{
                    try {{
                        const response = await fetch('{_serverUrl}/api/check-whatsapp', {{
                            method: 'POST',
                            headers: {{
                                'Content-Type': 'application/json'
                            }},
                            body: JSON.stringify({{ number: '{phoneNumber}' }})
                        }});
                        
                        const result = await response.json();
                        return result;
                    }} catch (error) {{
                        return {{
                            success: false,
                            error: error.message
                        }};
                    }}
                }})();"

            Dim resultJson = Await CoreWebView2.ExecuteScriptAsync(script)
            Dim response = JsonConvert.DeserializeObject(Of Dictionary(Of String, Object))(resultJson.Trim('"'c).Replace("\""", """"))

            If Boolean.Parse(response("success").ToString()) Then
                Dim data = JsonConvert.DeserializeObject(Of WhatsAppCheckResult)(response("data").ToString())
                RaiseEvent WhatsAppCheckCompleted(data)
                Return data
            Else
                Dim errorResult As New WhatsAppCheckResult With {
                    .Number = phoneNumber,
                    .HasWhatsApp = False,
                    .ErrorMessage = response("error").ToString()
                }
                RaiseEvent WhatsAppCheckCompleted(errorResult)
                Return errorResult
            End If

        Catch ex As Exception
            Dim errorResult As New WhatsAppCheckResult With {
                .Number = phoneNumber,
                .HasWhatsApp = False,
                .ErrorMessage = $"Error checking WhatsApp: {ex.Message}"
            }
            RaiseEvent WhatsAppCheckCompleted(errorResult)
            Return errorResult
        End Try
    End Function

    ''' <summary>
    ''' Check multiple phone numbers for WhatsApp
    ''' </summary>
    ''' <param name="phoneNumbers">List of phone numbers to check</param>
    ''' <returns>List of check results</returns>
    Public Async Function CheckWhatsAppBulkAsync(phoneNumbers As List(Of String)) As Task(Of List(Of WhatsAppCheckResult))
        Try
            If Not _isInitialized Then
                Throw New InvalidOperationException("WASession is not initialized. Call InitializeAsync first.")
            End If

            If Not _currentLoginStatus Then
                Throw New InvalidOperationException("Not logged in to WhatsApp. Please scan QR code first.")
            End If

            Dim results As New List(Of WhatsAppCheckResult)()

            ' Process numbers individually to avoid overwhelming the API
            For Each phoneNumber In phoneNumbers
                Try
                    Dim result = Await CheckWhatsAppAsync(phoneNumber)
                    results.Add(result)

                    ' Add delay between requests to prevent rate limiting
                    Await Task.Delay(2000)
                Catch ex As Exception
                    results.Add(New WhatsAppCheckResult With {
                        .Number = phoneNumber,
                        .HasWhatsApp = False,
                        .ErrorMessage = ex.Message
                    })
                End Try
            Next

            Return results

        Catch ex As Exception
            Throw New Exception($"Error in bulk WhatsApp check: {ex.Message}", ex)
        End Try
    End Function

    ''' <summary>
    ''' Check current login status
    ''' </summary>
    Public Async Function CheckLoginStatusAsync() As Task(Of Boolean)
        Try
            If _jsBridge IsNot Nothing Then
                Return Await _jsBridge.CheckLoginStatusAsync()
            Else
                Return False
            End If
        Catch
            Return False
        End Try
    End Function

    ''' <summary>
    ''' Refresh the WhatsApp interface
    ''' </summary>
    Public Sub RefreshInterface()
        If CoreWebView2 IsNot Nothing Then
            CoreWebView2.Reload()
        End If
    End Sub

    ''' <summary>
    ''' Navigate to WhatsApp Web
    ''' </summary>
    Public Sub NavigateToWhatsApp()
        If CoreWebView2 IsNot Nothing Then
            CoreWebView2.Navigate("https://web.whatsapp.com")
        End If
    End Sub

    ''' <summary>
    ''' Navigate back to local server
    ''' </summary>
    Public Sub NavigateToLocalServer()
        If CoreWebView2 IsNot Nothing Then
            CoreWebView2.Navigate(_serverUrl)
        End If
    End Sub

    ' Event handlers for JavaScript bridge communication
    Friend Sub OnLoginStatusChanged(isLoggedIn As Boolean)
        _currentLoginStatus = isLoggedIn
        RaiseEvent LoginStatusChanged(isLoggedIn)
    End Sub

    Friend Sub OnLoginCheckError(errorMessage As String)
        RaiseEvent LoginCheckError(errorMessage)
    End Sub

    Friend Sub OnPageInfoReceived(pageInfo As Dictionary(Of String, Object))
        RaiseEvent PageInfoReceived(pageInfo)
    End Sub

    Friend Sub OnBackendMessageReceived(message As Dictionary(Of String, Object))
        RaiseEvent BackendMessageReceived(message)
    End Sub

    Friend Sub OnJavaScriptLog(message As String)
        RaiseEvent JavaScriptLogReceived(message)
    End Sub

    Friend Sub OnBridgeError(errorMessage As String)
        RaiseEvent BridgeError(errorMessage)
    End Sub

    Friend Sub OnGenericMessage(eventType As String, data As String)
        RaiseEvent GenericMessage(eventType, data)
    End Sub

    ' WebView2 event handlers
    Private Async Sub OnNavigationCompleted(sender As Object, e As CoreWebView2NavigationCompletedEventArgs)
        Try
            If e.IsSuccess AndAlso _jsBridge IsNot Nothing Then
                ' Initialize bridge after navigation
                Await _jsBridge.InitializeAsync()
                
                ' Start monitoring login status
                Await Task.Delay(3000) ' Wait for page to fully load
                Await _jsBridge.StartLoginMonitoringAsync()
            End If
        Catch ex As Exception
            RaiseEvent BridgeError($"Navigation completed error: {ex.Message}")
        End Try
    End Sub

    Private Async Sub OnDOMContentLoaded(sender As Object, e As CoreWebView2DOMContentLoadedEventArgs)
        Try
            If _jsBridge IsNot Nothing Then
                ' Get page info when DOM is loaded
                Await Task.Delay(1000) ' Brief delay to ensure content is ready
                Await _jsBridge.GetPageInfoAsync()
            End If
        Catch ex As Exception
            RaiseEvent BridgeError($"DOM content loaded error: {ex.Message}")
        End Try
    End Sub

    Private Sub OnDocumentTitleChanged(sender As Object, e As Object)
        ' Can be used to detect page changes
    End Sub

    ''' <summary>
    ''' Initialize component (placeholder for designer)
    ''' </summary>
    Private Sub InitializeComponent()
        ' This method is for Windows Forms designer compatibility
        ' The actual initialization is done in InitializeAsync
    End Sub

    ''' <summary>
    ''' Dispose resources
    ''' </summary>
    Protected Overrides Sub Dispose(disposing As Boolean)
        Try
            If disposing Then
                If _jsBridge IsNot Nothing Then
                    ' Stop monitoring when disposing
                    Task.Run(Async Function() Await _jsBridge.StopLoginMonitoringAsync())
                End If
            End If
        Finally
            MyBase.Dispose(disposing)
        End Try
    End Sub
End Class