# PowerShell script to test SSE connection

Write-Host "Testing SSE connection to http://localhost:8090/sse"
Write-Host "Press Ctrl+C to stop"

$url = "http://localhost:8090/sse"

try {
    $request = [System.Net.WebRequest]::Create($url)
    $request.Headers.Add("Accept", "text/event-stream")
    $response = $request.GetResponse()
    $stream = $response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)

    while ($true) {
        $line = $reader.ReadLine()
        if ($line) {
            Write-Host $line
        }
    }
}
catch {
    Write-Host "Error: $_"
}
finally {
    if ($reader) { $reader.Close() }
    if ($response) { $response.Close() }
} 