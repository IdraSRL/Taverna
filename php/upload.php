<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Check if request is POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Check if room is specified
if (!isset($_POST['room']) || empty($_POST['room'])) {
    echo json_encode(['success' => false, 'error' => 'Room not specified']);
    exit;
}

$room = preg_replace('/[^a-zA-Z0-9_-]/', '', $_POST['room']); // Sanitize room name
$type = isset($_POST['type']) ? $_POST['type'] : 'unknown';

// Determine file field and validation based on type
$fileField = null;
$allowedTypes = [];
$maxSize = 50 * 1024 * 1024; // Default 50MB

switch ($type) {
    case 'music':
        $fileField = 'music';
        $allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
        $maxSize = 100 * 1024 * 1024; // 100MB for music
        break;
    case 'map':
        $fileField = 'map';
        $allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        $maxSize = 50 * 1024 * 1024; // 50MB for maps
        break;
    case 'token':
        $fileField = 'token';
        $allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        $maxSize = 10 * 1024 * 1024; // 10MB for tokens
        break;
    case 'sheet':
        $fileField = 'sheet';
        $allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
        $maxSize = 50 * 1024 * 1024; // 50MB for sheets
        break;
    default:
        echo json_encode(['success' => false, 'error' => 'Invalid file type']);
        exit;
}

// Check if file was uploaded
if (!isset($_FILES[$fileField]) || $_FILES[$fileField]['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'error' => 'No file uploaded or upload error']);
    exit;
}

$file = $_FILES[$fileField];

// Validate file type
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mimeType, $allowedTypes)) {
    $allowedTypesStr = implode(', ', $allowedTypes);
    echo json_encode(['success' => false, 'error' => "Invalid file type. Allowed types: $allowedTypesStr"]);
    exit;
}

// Validate file size
if ($file['size'] > $maxSize) {
    $maxSizeMB = round($maxSize / 1024 / 1024);
    echo json_encode(['success' => false, 'error' => "File too large. Maximum size is {$maxSizeMB}MB."]);
    exit;
}

// Create uploads directory structure (one level up from php folder)
$uploadDir = "../uploads/$type/$room/";
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        echo json_encode(['success' => false, 'error' => 'Failed to create upload directory']);
        exit;
    }
}

// Generate unique filename
$extension = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = uniqid() . '_' . time() . '.' . $extension;
$filepath = $uploadDir . $filename;

// Move uploaded file
if (!move_uploaded_file($file['tmp_name'], $filepath)) {
    echo json_encode(['success' => false, 'error' => 'Failed to save file']);
    exit;
}

// Generate URL for the file (correct path without php folder)
$protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'];
$scriptDir = dirname($_SERVER['REQUEST_URI']);
$baseUrl = $protocol . '://' . $host . dirname($scriptDir); // Go up one level from php folder
$fileUrl = $baseUrl . "/uploads/$type/$room/" . $filename;

// Return success response
echo json_encode([
    'success' => true,
    'filename' => $filename,
    'url' => $fileUrl,
    'size' => $file['size'],
    'type' => $mimeType
]);
?>