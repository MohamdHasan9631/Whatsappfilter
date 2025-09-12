Imports System
Imports System.Threading.Tasks
Imports Newtonsoft.Json

''' <summary>
''' Console demo program that demonstrates the VB.NET WhatsApp integration concepts
''' This runs on any platform and shows how the classes would work in a Windows environment
''' </summary>
Module DemoProgram
    Sub Main()
        Console.WriteLine("WhatsApp VB.NET Integration Demo")
        Console.WriteLine("================================")
        Console.WriteLine()
        
        RunDemo().Wait()
        
        Console.WriteLine()
        Console.WriteLine("Demo completed. Press any key to exit...")
        Console.ReadKey()
    End Sub
    
    Private Async Function RunDemo() As Task
        Try
            ' Demonstrate BusinessAccountInfo class
            Console.WriteLine("1. Testing BusinessAccountInfo class:")
            Console.WriteLine("=====================================")
            
            Dim businessInfo As New BusinessAccountInfo() With {
                .VerifiedName = "Tech Solutions LLC",
                .Category = "Technology Services",
                .Description = "We provide innovative software solutions for businesses",
                .Website = "https://techsolutions.example.com",
                .Email = "contact@techsolutions.example.com",
                .Address = "123 Business St, Tech City, TC 12345"
            }
            
            Console.WriteLine($"Has Information: {businessInfo.HasInformation}")
            Console.WriteLine("Business Summary:")
            Console.WriteLine(businessInfo.GetSummary())
            
            ' Demonstrate WhatsAppCheckResult class
            Console.WriteLine("2. Testing WhatsAppCheckResult class:")
            Console.WriteLine("=====================================")
            
            Dim result As New WhatsAppCheckResult() With {
                .Number = "+962791234567",
                .HasWhatsApp = True,
                .IsBusiness = True,
                .Name = "Ahmed's Electronics",
                .Country = "JO",
                .BusinessInfo = businessInfo
            }
            
            Console.WriteLine($"Number: {result.Number}")
            Console.WriteLine($"Has WhatsApp: {result.HasWhatsApp}")
            Console.WriteLine($"Is Business: {result.IsBusiness}")
            Console.WriteLine($"Display Name: {result.DisplayName}")
            Console.WriteLine($"Country: {result.Country}")
            Console.WriteLine($"Has Error: {result.HasError}")
            
            ' Demonstrate JSON serialization (for API communication)
            Console.WriteLine()
            Console.WriteLine("3. Testing JSON Serialization:")
            Console.WriteLine("==============================")
            
            Dim json = JsonConvert.SerializeObject(result, Formatting.Indented)
            Console.WriteLine("Serialized Result:")
            Console.WriteLine(json)
            
            ' Demonstrate deserialization
            Dim deserializedResult = JsonConvert.DeserializeObject(Of WhatsAppCheckResult)(json)
            Console.WriteLine()
            Console.WriteLine($"Deserialized Display Name: {deserializedResult.DisplayName}")
            
            ' Simulate API response handling
            Console.WriteLine()
            Console.WriteLine("4. Simulating API Response Handling:")
            Console.WriteLine("====================================")
            
            Await SimulateApiCall("+966501234567")
            Await SimulateApiCall("+971501234567")
            Await SimulateApiCall("invalid-number")
            
            ' Demonstrate error handling
            Console.WriteLine()
            Console.WriteLine("5. Testing Error Handling:")
            Console.WriteLine("==========================")
            
            Dim errorResult As New WhatsAppCheckResult() With {
                .Number = "+999999999999",
                .ErrorMessage = "Number format is invalid"
            }
            
            Console.WriteLine($"Error Result - Has Error: {errorResult.HasError}")
            Console.WriteLine($"Error Message: {errorResult.ErrorMessage}")
            
        Catch ex As Exception
            Console.WriteLine($"Demo Error: {ex.Message}")
        End Try
    End Function
    
    ''' <summary>
    ''' Simulate an API call to check a WhatsApp number
    ''' </summary>
    Private Async Function SimulateApiCall(phoneNumber As String) As Task
        Console.WriteLine($"Checking {phoneNumber}...")
        
        ' Simulate network delay
        Await Task.Delay(500)
        
        ' Simulate different responses based on number
        If phoneNumber.Contains("invalid") Then
            Console.WriteLine($"  ❌ Error: Invalid phone number format")
        ElseIf phoneNumber.StartsWith("+966") Then
            Console.WriteLine($"  ✅ {phoneNumber} has WhatsApp (Business Account)")
        ElseIf phoneNumber.StartsWith("+971") Then
            Console.WriteLine($"  ✅ {phoneNumber} has WhatsApp (Personal Account)")
        Else
            Console.WriteLine($"  ❌ {phoneNumber} does not have WhatsApp")
        End If
    End Function
End Module

''' <summary>
''' Demonstrates how WASession events would work in a real Windows application
''' </summary>
Public Class WASessionEventDemo
    Public Event LoginStatusChanged(isLoggedIn As Boolean)
    Public Event WhatsAppCheckCompleted(result As WhatsAppCheckResult)
    Public Event BridgeError(errorMessage As String)
    
    Public Sub SimulateEvents()
        Console.WriteLine("6. Simulating WASession Events:")
        Console.WriteLine("===============================")
        
        ' Simulate login status change
        RaiseEvent LoginStatusChanged(True)
        
        ' Simulate WhatsApp check completion
        Dim result As New WhatsAppCheckResult() With {
            .Number = "+962791234567",
            .HasWhatsApp = True,
            .Name = "John Doe"
        }
        RaiseEvent WhatsAppCheckCompleted(result)
        
        ' Simulate bridge error
        RaiseEvent BridgeError("Connection to backend server lost")
    End Sub
    
    ' Event handlers (would be in MainForm in real application)
    Public Sub OnLoginStatusChanged(isLoggedIn As Boolean) Handles Me.LoginStatusChanged
        Console.WriteLine($"  Event: Login status changed to {isLoggedIn}")
    End Sub
    
    Public Sub OnWhatsAppCheckCompleted(result As WhatsAppCheckResult) Handles Me.WhatsAppCheckCompleted
        Console.WriteLine($"  Event: Check completed for {result.Number} - Result: {result.HasWhatsApp}")
    End Sub
    
    Public Sub OnBridgeError(errorMessage As String) Handles Me.BridgeError
        Console.WriteLine($"  Event: Bridge error - {errorMessage}")
    End Sub
End Class