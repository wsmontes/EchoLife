# Echo Life

A simple web application that captures voice input, transcribes it using OpenAI's Whisper API, and enables interaction with OpenAI's GPT-4.

## Features

- Record audio directly in the browser
- Automatic transcription using OpenAI's Whisper API
- AI chat interaction using OpenAI's GPT-4
- Clean, responsive user interface
- Simple to deploy - no backend required

## Setup

### Prerequisites

- OpenAI API key with access to Whisper and GPT-4
- Modern web browser with microphone access
- GitHub account (for deployment)

### Local Development

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/EchoLife.git
   cd EchoLife
   ```

2. Open `index.html` in your browser or use a local server:
   ```
   npx serve
   ```

3. When prompted, enter your OpenAI API key. It will be stored in your browser's localStorage.

### Deployment

#### Option 1: GitHub Pages

1. Create a GitHub repository
2. Push this code to your repository:
   ```
   git remote add origin https://github.com/yourusername/EchoLife.git
   git push -u origin main
   ```
3. Go to repository settings > Pages
4. Set the source to your main branch
5. Your site will be published at `https://yourusername.github.io/EchoLife/`

#### Option 2: Netlify

1. Create an account on [Netlify](https://www.netlify.com/)
2. Connect your GitHub repository
3. Deploy using the Netlify interface

## Security Note

This application stores your API key in the browser's localStorage. While convenient for development and personal use, this approach is not recommended for production applications with multiple users. Consider implementing a secure backend for API key management in production.

## Usage

1. Click the microphone button to start recording.
2. Speak clearly into your microphone.
3. Click the button again to stop recording.
4. Your speech will be automatically transcribed.
5. Edit the transcript if needed.
6. Click "Submit to AI" to send your transcript to GPT-4.
7. View the AI's response in the chat section.

## License

MIT License
