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

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Check if filename, room and type are provided
if (!isset($input['filename']) || !isset($input['room']) || !isset($input['type'])) {
    echo json_encode(['success' => false, 'error' => 'Filename, room and type are required']);
    exit;
}

$filename = basename($input['filename']); // Sanitize filename
$room = preg_replace('/[^a-zA-Z0-9_-]/', '', $input['room']); // Sanitize room name
$type = preg_replace('/[^a-zA-Z0-9_-]/', '', $input['type']); // Sanitize type

// Construct file path based on type (one level up from php folder)
$filepath = "../uploads/$type/$room/$filename";

// Check if file exists
if (!file_exists($filepath)) {
    echo json_encode(['success' => false, 'error' => 'File not found']);
    exit;
}

// Delete file
if (unlink($filepath)) {
    // Check if directory is empty and remove it
    $uploadDir = "../uploads/$type/$room/";
    if (is_dir($uploadDir) && count(scandir($uploadDir)) === 2) { // Only . and .. entries
        rmdir($uploadDir);
        
        // Check if parent type directory is empty and remove it
        $typeDir = "../uploads/$type/";
        if (is_dir($typeDir) && count(scandir($typeDir)) === 2) {
            rmdir($typeDir);
        }
    }
    
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'error' => 'Failed to delete file']);
}
?>