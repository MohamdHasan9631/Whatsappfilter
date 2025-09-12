Imports System.ComponentModel
Imports System.Drawing
Imports System.Threading.Tasks
Imports System.Windows.Forms

''' <summary>
''' Main form that hosts the WASession WebView2 control
''' </summary>
Public Class MainForm
    Inherits Form

    ' Controls
    Private WithEvents waSession As WASession
    Private statusStrip As StatusStrip
    Private lblStatus As ToolStripStatusLabel
    Private lblLoginStatus As ToolStripStatusLabel
    Private menuStrip As MenuStrip
    Private mnuFile As ToolStripMenuItem
    Private mnuCheckNumber As ToolStripMenuItem
    Private mnuRefresh As ToolStripMenuItem
    Private mnuNavigateWhatsApp As ToolStripMenuItem
    Private mnuNavigateLocal As ToolStripMenuItem
    Private mnuHelp As ToolStripMenuItem
    Private mnuAbout As ToolStripMenuItem
    Private panel As Panel
    Private txtPhoneNumber As TextBox
    Private btnCheckNumber As Button
    Private lblResult As Label

    ' Constructor
    Public Sub New()
        InitializeComponent()
        SetupUI()
    End Sub

    ''' <summary>
    ''' Initialize form components
    ''' </summary>
    Private Sub InitializeComponent()
        Me.Text = "WhatsApp Integration - VB.NET WebView2"
        Me.Size = New Size(1200, 800)
        Me.StartPosition = FormStartPosition.CenterScreen
        Me.MinimumSize = New Size(800, 600)
    End Sub

    ''' <summary>
    ''' Setup the user interface
    ''' </summary>
    Private Sub SetupUI()
        ' Create menu strip
        menuStrip = New MenuStrip()
        
        ' File menu
        mnuFile = New ToolStripMenuItem("&File")
        mnuCheckNumber = New ToolStripMenuItem("&Check Number", Nothing, AddressOf CheckNumber_Click)
        mnuCheckNumber.ShortcutKeys = Keys.Control Or Keys.N
        mnuRefresh = New ToolStripMenuItem("&Refresh", Nothing, AddressOf Refresh_Click)
        mnuRefresh.ShortcutKeys = Keys.F5
        mnuNavigateWhatsApp = New ToolStripMenuItem("Navigate to &WhatsApp Web", Nothing, AddressOf NavigateWhatsApp_Click)
        mnuNavigateLocal = New ToolStripMenuItem("Navigate to &Local Server", Nothing, AddressOf NavigateLocal_Click)
        
        mnuFile.DropDownItems.AddRange({mnuCheckNumber, New ToolStripSeparator(), mnuRefresh, New ToolStripSeparator(), mnuNavigateWhatsApp, mnuNavigateLocal})
        
        ' Help menu
        mnuHelp = New ToolStripMenuItem("&Help")
        mnuAbout = New ToolStripMenuItem("&About", Nothing, AddressOf About_Click)
        mnuHelp.DropDownItems.Add(mnuAbout)
        
        menuStrip.Items.AddRange({mnuFile, mnuHelp})
        
        ' Create status strip
        statusStrip = New StatusStrip()
        lblStatus = New ToolStripStatusLabel("Initializing...")
        lblLoginStatus = New ToolStripStatusLabel("Not Connected")
        lblLoginStatus.Spring = True
        lblLoginStatus.TextAlign = ContentAlignment.MiddleRight
        statusStrip.Items.AddRange({lblStatus, lblLoginStatus})
        
        ' Create input panel
        panel = New Panel()
        panel.Height = 60
        panel.Dock = DockStyle.Top
        panel.BackColor = SystemColors.Control
        panel.Padding = New Padding(10)
        
        ' Phone number input
        Dim lblPhone As New Label()
        lblPhone.Text = "Phone Number:"
        lblPhone.Location = New Point(10, 15)
        lblPhone.AutoSize = True
        
        txtPhoneNumber = New TextBox()
        txtPhoneNumber.Location = New Point(100, 12)
        txtPhoneNumber.Width = 200
        txtPhoneNumber.PlaceholderText = "+962791234567"
        
        btnCheckNumber = New Button()
        btnCheckNumber.Text = "Check WhatsApp"
        btnCheckNumber.Location = New Point(310, 10)
        btnCheckNumber.Width = 120
        AddHandler btnCheckNumber.Click, AddressOf CheckNumber_Click
        
        lblResult = New Label()
        lblResult.Location = New Point(440, 15)
        lblResult.AutoSize = True
        lblResult.ForeColor = Color.Blue
        
        panel.Controls.AddRange({lblPhone, txtPhoneNumber, btnCheckNumber, lblResult})
        
        ' Create WASession control
        waSession = New WASession()
        waSession.Dock = DockStyle.Fill
        
        ' Setup event handlers
        AddHandler waSession.LoginStatusChanged, AddressOf OnLoginStatusChanged
        AddHandler waSession.LoginCheckError, AddressOf OnLoginCheckError
        AddHandler waSession.WhatsAppCheckCompleted, AddressOf OnWhatsAppCheckCompleted
        AddHandler waSession.BridgeError, AddressOf OnBridgeError
        AddHandler waSession.JavaScriptLogReceived, AddressOf OnJavaScriptLog
        
        ' Add controls to form
        Me.Controls.Add(waSession)
        Me.Controls.Add(panel)
        Me.Controls.Add(statusStrip)
        Me.Controls.Add(menuStrip)
        Me.MainMenuStrip = menuStrip
    End Sub

    ''' <summary>
    ''' Form load event - initialize WASession
    ''' </summary>
    Private Async Sub MainForm_Load(sender As Object, e As EventArgs) Handles MyBase.Load
        Try
            lblStatus.Text = "Initializing WebView2..."
            Await waSession.InitializeAsync()
            lblStatus.Text = "WebView2 initialized. Loading WhatsApp interface..."
        Catch ex As Exception
            MessageBox.Show($"Failed to initialize WhatsApp session: {ex.Message}", "Initialization Error", MessageBoxButtons.OK, MessageBoxIcon.Error)
            lblStatus.Text = "Initialization failed"
        End Try
    End Sub

    ''' <summary>
    ''' Check a phone number for WhatsApp
    ''' </summary>
    Private Async Sub CheckNumber_Click(sender As Object, e As EventArgs)
        Dim phoneNumber = txtPhoneNumber.Text.Trim()
        
        If String.IsNullOrEmpty(phoneNumber) Then
            MessageBox.Show("Please enter a phone number", "Input Required", MessageBoxButtons.OK, MessageBoxIcon.Warning)
            txtPhoneNumber.Focus()
            Return
        End If
        
        Try
            btnCheckNumber.Enabled = False
            lblResult.Text = "Checking..."
            lblResult.ForeColor = Color.Blue
            
            Dim result = Await waSession.CheckWhatsAppAsync(phoneNumber)
            
            If result.HasError Then
                lblResult.Text = $"Error: {result.ErrorMessage}"
                lblResult.ForeColor = Color.Red
            ElseIf result.HasWhatsApp Then
                Dim info = $"✓ Has WhatsApp"
                If result.IsBusiness Then
                    info += " (Business)"
                    If result.BusinessInfo IsNot Nothing AndAlso result.BusinessInfo.HasInformation Then
                        info += $" - {result.BusinessInfo.VerifiedName}"
                    End If
                End If
                lblResult.Text = info
                lblResult.ForeColor = Color.Green
            Else
                lblResult.Text = "✗ No WhatsApp"
                lblResult.ForeColor = Color.Red
            End If
            
        Catch ex As Exception
            lblResult.Text = $"Error: {ex.Message}"
            lblResult.ForeColor = Color.Red
        Finally
            btnCheckNumber.Enabled = True
        End Try
    End Sub

    ''' <summary>
    ''' Refresh the interface
    ''' </summary>
    Private Sub Refresh_Click(sender As Object, e As EventArgs)
        waSession.RefreshInterface()
        lblStatus.Text = "Interface refreshed"
    End Sub

    ''' <summary>
    ''' Navigate to WhatsApp Web
    ''' </summary>
    Private Sub NavigateWhatsApp_Click(sender As Object, e As EventArgs)
        waSession.NavigateToWhatsApp()
        lblStatus.Text = "Navigating to WhatsApp Web..."
    End Sub

    ''' <summary>
    ''' Navigate to local server
    ''' </summary>
    Private Sub NavigateLocal_Click(sender As Object, e As EventArgs)
        waSession.NavigateToLocalServer()
        lblStatus.Text = "Navigating to local server..."
    End Sub

    ''' <summary>
    ''' Show about dialog
    ''' </summary>
    Private Sub About_Click(sender As Object, e As EventArgs)
        MessageBox.Show(
            "WhatsApp Integration for VB.NET" & vbCrLf &
            "Using WebView2 and wppconnect" & vbCrLf & vbCrLf &
            "This application provides a VB.NET wrapper around" & vbCrLf &
            "the WhatsApp Web interface for checking phone numbers.",
            "About", MessageBoxButtons.OK, MessageBoxIcon.Information)
    End Sub

    ' Event handlers for WASession events
    Private Sub OnLoginStatusChanged(isLoggedIn As Boolean)
        ' Update UI on the main thread
        If InvokeRequired Then
            Invoke(Sub() OnLoginStatusChanged(isLoggedIn))
            Return
        End If
        
        If isLoggedIn Then
            lblLoginStatus.Text = "✓ Connected to WhatsApp"
            lblLoginStatus.ForeColor = Color.Green
            lblStatus.Text = "Ready to check phone numbers"
            btnCheckNumber.Enabled = True
        Else
            lblLoginStatus.Text = "✗ Not Connected - Scan QR Code"
            lblLoginStatus.ForeColor = Color.Red
            lblStatus.Text = "Please scan QR code to connect"
            btnCheckNumber.Enabled = False
        End If
    End Sub

    Private Sub OnLoginCheckError(errorMessage As String)
        If InvokeRequired Then
            Invoke(Sub() OnLoginCheckError(errorMessage))
            Return
        End If
        
        lblStatus.Text = $"Login check error: {errorMessage}"
        lblLoginStatus.Text = "Connection Error"
        lblLoginStatus.ForeColor = Color.Red
    End Sub

    Private Sub OnWhatsAppCheckCompleted(result As WhatsAppCheckResult)
        If InvokeRequired Then
            Invoke(Sub() OnWhatsAppCheckCompleted(result))
            Return
        End If
        
        ' This event can be used for additional processing
        ' The UI is already updated in CheckNumber_Click
        lblStatus.Text = $"Check completed for {result.Number}"
    End Sub

    Private Sub OnBridgeError(errorMessage As String)
        If InvokeRequired Then
            Invoke(Sub() OnBridgeError(errorMessage))
            Return
        End If
        
        lblStatus.Text = $"Bridge Error: {errorMessage}"
        ' Could also log to file or show in a separate log window
    End Sub

    Private Sub OnJavaScriptLog(message As String)
        ' Can be used for debugging JavaScript issues
        ' For now, just update status with latest log
        If InvokeRequired Then
            Invoke(Sub() OnJavaScriptLog(message))
            Return
        End If
        
        Console.WriteLine($"JS Log: {message}")
    End Sub

    ''' <summary>
    ''' Handle form closing
    ''' </summary>
    Protected Overrides Sub OnFormClosing(e As FormClosingEventArgs)
        Try
            ' Cleanup resources
            If waSession IsNot Nothing Then
                waSession.Dispose()
            End If
        Finally
            MyBase.OnFormClosing(e)
        End Try
    End Sub

    ''' <summary>
    ''' Handle Enter key in phone number textbox
    ''' </summary>
    Private Sub txtPhoneNumber_KeyPress(sender As Object, e As KeyPressEventArgs) Handles txtPhoneNumber.KeyPress
        If e.KeyChar = ChrW(Keys.Enter) Then
            e.Handled = True
            CheckNumber_Click(sender, e)
        End If
    End Sub
End Class