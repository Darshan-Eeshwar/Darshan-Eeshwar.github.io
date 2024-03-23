<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect form data
    $first_name = $_POST['first_name'];
    // Retrieve other form fields

    // Set up email content
    $to = 'starwaltcompany@gmail.com';
    $subject = 'New Contact Form Submission';
    $message = "First Name: $first_name\n";
    // Include other form fields in the email message

    // Send email
    if (mail($to, $subject, $message)) {
        echo 'Thank you! Your message has been sent.';
    } else {
        echo 'Oops! Something went wrong.';
    }
}
?>
