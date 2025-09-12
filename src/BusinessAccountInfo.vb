Imports Newtonsoft.Json

''' <summary>
''' Represents business account information for WhatsApp business accounts
''' </summary>
Public Class BusinessAccountInfo
    <JsonProperty("description")>
    Public Property Description As String

    <JsonProperty("category")>
    Public Property Category As String

    <JsonProperty("website")>
    Public Property Website As String

    <JsonProperty("email")>
    Public Property Email As String

    <JsonProperty("address")>
    Public Property Address As String

    <JsonProperty("verifiedName")>
    Public Property VerifiedName As String

    <JsonProperty("products")>
    Public Property Products As List(Of Object)

    Public Sub New()
        Products = New List(Of Object)()
    End Sub

    ''' <summary>
    ''' Check if this business account has any information
    ''' </summary>
    ''' <returns>True if any business information is available</returns>
    Public ReadOnly Property HasInformation As Boolean
        Get
            Return Not String.IsNullOrEmpty(Description) OrElse
                   Not String.IsNullOrEmpty(Category) OrElse
                   Not String.IsNullOrEmpty(Website) OrElse
                   Not String.IsNullOrEmpty(Email) OrElse
                   Not String.IsNullOrEmpty(Address) OrElse
                   Not String.IsNullOrEmpty(VerifiedName) OrElse
                   (Products IsNot Nothing AndAlso Products.Count > 0)
        End Get
    End Property

    ''' <summary>
    ''' Get a summary string of the business information
    ''' </summary>
    ''' <returns>Summary of business details</returns>
    Public Function GetSummary() As String
        Dim summary As New System.Text.StringBuilder()

        If Not String.IsNullOrEmpty(VerifiedName) Then
            summary.AppendLine($"Business Name: {VerifiedName}")
        End If

        If Not String.IsNullOrEmpty(Category) Then
            summary.AppendLine($"Category: {Category}")
        End If

        If Not String.IsNullOrEmpty(Description) Then
            summary.AppendLine($"Description: {Description}")
        End If

        If Not String.IsNullOrEmpty(Website) Then
            summary.AppendLine($"Website: {Website}")
        End If

        If Not String.IsNullOrEmpty(Email) Then
            summary.AppendLine($"Email: {Email}")
        End If

        If Not String.IsNullOrEmpty(Address) Then
            summary.AppendLine($"Address: {Address}")
        End If

        If Products IsNot Nothing AndAlso Products.Count > 0 Then
            summary.AppendLine($"Products: {Products.Count} available")
        End If

        Return summary.ToString()
    End Function
End Class

''' <summary>
''' Represents the result of a WhatsApp number check
''' </summary>
Public Class WhatsAppCheckResult
    <JsonProperty("hasWhatsApp")>
    Public Property HasWhatsApp As Boolean

    <JsonProperty("number")>
    Public Property Number As String

    <JsonProperty("profilePicture")>
    Public Property ProfilePicture As String

    <JsonProperty("isBusiness")>
    Public Property IsBusiness As Boolean

    <JsonProperty("businessInfo")>
    Public Property BusinessInfo As BusinessAccountInfo

    <JsonProperty("name")>
    Public Property Name As String

    <JsonProperty("status")>
    Public Property Status As String

    <JsonProperty("lastSeen")>
    Public Property LastSeen As String

    <JsonProperty("isContact")>
    Public Property IsContact As Boolean

    <JsonProperty("country")>
    Public Property Country As String

    <JsonProperty("error")>
    Public Property ErrorMessage As String

    Public Sub New()
        BusinessInfo = New BusinessAccountInfo()
    End Sub

    ''' <summary>
    ''' Check if the result has any errors
    ''' </summary>
    ''' <returns>True if there are errors</returns>
    Public ReadOnly Property HasError As Boolean
        Get
            Return Not String.IsNullOrEmpty(ErrorMessage)
        End Get
    End Property

    ''' <summary>
    ''' Get a display name for the WhatsApp account
    ''' </summary>
    ''' <returns>Best available name for display</returns>
    Public ReadOnly Property DisplayName As String
        Get
            If IsBusiness AndAlso BusinessInfo IsNot Nothing AndAlso Not String.IsNullOrEmpty(BusinessInfo.VerifiedName) Then
                Return BusinessInfo.VerifiedName
            ElseIf Not String.IsNullOrEmpty(Name) Then
                Return Name
            Else
                Return Number
            End If
        End Get
    End Property
End Class