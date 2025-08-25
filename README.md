# PDF to Word Converter Tool

This project is a simple one-page web tool that allows users to convert PDF files into Word documents. The application is designed to be user-friendly and efficient, providing a seamless experience for file conversion.

## Project Structure

```
pdf-to-word-converter
├── public
│   ├── index.html        # The main page that users interact with
│   ├── pdfToWord.js      # Handles PDF-to-Word conversion logic (likely front-end interactions)
│   └── styles.css        # Styling for the app
├── src
│   ├── app.js            # JS for user interactions (upload button, status updates, etc.)
│   ├── Output Folder     # Folder where converted Word files will be saved
│   ├── uploads Folder    # Folder to temporarily store uploaded PDF files
├── package.json           # Node.js configuration file (dependencies, scripts)
├── README.md              # Project documentation
└── convert.py             # Python script that does the actual PDF → Word conversion

```

## Getting Started

To get started with the PDF to Word converter tool, follow these steps:

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd pdf-to-word-converter
   ```

2. **Install dependencies**:
   Make sure you have Node.js installed. Then run:
   ```bash
   npm install
   ```

3. **Run the application**:
   You can start the application using:
   ```bash
   npm start
   ```

4. **Open your browser**:
   Navigate to `http://localhost:3000` (or the port specified in your configuration) to access the tool.

## Usage

1. Upload a PDF file using the provided form.
2. Click the "Convert" button to initiate the conversion process.
3. Once the conversion is complete, download the resulting Word document.

## Contributing

Contributions are welcome! If you have suggestions for improvements or new features, please open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for details.