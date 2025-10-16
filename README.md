# LetMeCook 🧑‍🍳

An AI-powered study platform with three learning modes: Study, Exam, and Flashcard. Powered by Google's Gemini API.

![Tests](https://github.com/Ayan-Nalawade/LetMeCook/actions/workflows/test.yml/badge.svg)

## Features

- 📚 **Study Mode**: Comprehensive learning with explanations and summaries
- 📝 **Exam Mode**: Test yourself with challenging questions and get AI feedback
- 🎴 **Flashcard Mode**: Quick recall with infinite flashcards and multiple-choice questions
- 📁 **File Upload**: Support for PDF, PPTX, TXT, MD, and more (up to 20MB)
- 🔒 **Secure**: API key stored locally in your browser, never sent to any server except Google
- 🎯 **Score Tracking**: Real-time tracking of your performance in flashcard mode
- 🌙 **Dark Theme**: Easy on the eyes for extended study sessions

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))

### Usage

1. Clone or download this repository
2. Open `index.html` in your web browser
3. Enter your Gemini API key when prompted
4. Upload study materials or paste text
5. Choose your learning mode and start studying!

## Testing

### Automated Tests (GitHub Actions)

Every push to the repository triggers automated tests that check:
- ✅ HTML structure validation
- ✅ JavaScript syntax checking
- ✅ Security checks (no hardcoded API keys)
- ✅ Critical function verification
- ✅ Browser compatibility tests (Chrome, Firefox, Safari)
- ✅ UI/UX functionality tests
- ✅ LocalStorage security validation
- ✅ Responsive design tests

### Running Tests Locally

#### Quick Tests (No installation required)

```bash
# Check JavaScript syntax
node -c app.js

# Verify critical functions
grep -q "validateAndStoreKey" app.js && echo "✓ Functions OK"

# Start local server
npx http-server -p 8080
# Visit http://localhost:8080
```

#### Full Test Suite (With Playwright)

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests in headed mode (see browser)
npm run test:headed
```

### Test Coverage

Our test suite includes:

1. **API Key Validation Tests**
   - Format validation
   - Empty key rejection
   - Invalid format detection
   - LocalStorage security

2. **File Upload Tests**
   - Correct file type acceptance
   - Text input functionality
   - Process button visibility

3. **Mode Selection Tests**
   - All three modes present
   - Mode card functionality
   - Navigation between modes

4. **UI Element Tests**
   - Header and title
   - Loading states
   - Modal behavior
   - Button functionality

5. **Responsive Design Tests**
   - Mobile (375px)
   - Tablet (768px)
   - Desktop (1200px+)

6. **JavaScript Function Tests**
   - Markdown conversion
   - Flashcard navigation
   - Score tracking
   - API integration

## Project Structure

```
LetMeCook/
├── index.html              # Main HTML structure
├── styles.css              # Complete styling (dark theme)
├── app.js                  # All JavaScript functionality
├── package.json            # NPM dependencies for testing
├── playwright.config.js    # Playwright test configuration
├── tests/
│   └── app.spec.js        # Browser-based tests
├── .github/
│   └── workflows/
│       └── test.yml       # GitHub Actions CI/CD
└── README.md              # This file
```

## Security Features

- ✅ API key format validation
- ✅ No hardcoded credentials
- ✅ Client-side only processing
- ✅ LocalStorage validation on startup
- ✅ File size limits (20MB)
- ✅ Automatic cleanup of invalid keys

## Technologies Used

- **Frontend**: Vanilla HTML, CSS, JavaScript
- **API**: Google Gemini API (gemini-2.0-flash-exp / gemini-1.5-flash)
- **Testing**: Playwright, ESLint, HTML Validator
- **CI/CD**: GitHub Actions
- **Storage**: Browser LocalStorage

## Browser Compatibility

- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Push to your fork
6. Open a Pull Request

All PRs are automatically tested via GitHub Actions.

## License

See LICENSE file for details.

## Support

If you encounter any issues:
1. Check that your Gemini API key is valid
2. Clear your browser's LocalStorage and try again
3. Make sure you're using a supported file format
4. Check the browser console for error messages

## Acknowledgments

- Powered by Google Gemini API
- Built with modern web standards
- Tested with Playwright
