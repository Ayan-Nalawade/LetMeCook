const storageIdentifier = 'gemini_auth_token';
const uploadedFilesRegistry = [];
let processedMaterial = null;
let currentActiveLearningMode = null;
const primaryModel = 'gemini-2.0-flash-exp';
const fallbackModel = 'gemini-1.5-flash';
let activeModelName = primaryModel;

const elements = {
    apiModal: document.getElementById('apiKeyModal'),
    apiInput: document.getElementById('apiKeyInput'),
    validateButton: document.getElementById('validateApiKey'),
    validationDisplay: document.getElementById('validationStatus'),
    mainApplication: document.getElementById('mainApp'),
    changeKeyButton: document.getElementById('changeApiKey'),
    fileSelector: document.getElementById('fileInput'),
    textBox: document.getElementById('textInput'),
    processButton: document.getElementById('processContent'),
    uploadDisplay: document.getElementById('uploadStatus'),
    modePanel: document.getElementById('modeSelection'),
    contentPanel: document.getElementById('contentArea'),
    contentRenderer: document.getElementById('contentDisplay'),
    modeTitle: document.getElementById('currentModeTitle'),
    backButton: document.getElementById('backToModes'),
    loadingScreen: document.getElementById('loadingOverlay'),
    loadingMessage: document.getElementById('loadingText')
};

function initializeApplication() {
    const savedToken = localStorage.getItem(storageIdentifier);
    if (savedToken && isValidApiKeyFormat(savedToken)) {
        elements.apiModal.classList.add('hidden');
        elements.mainApplication.classList.remove('hidden');
    } else if (savedToken) {
        localStorage.removeItem(storageIdentifier);
    }

    elements.validateButton.addEventListener('click', validateAndStoreKey);
    elements.changeKeyButton.addEventListener('click', promptForNewKey);
    elements.processButton.addEventListener('click', handleContentProcessing);
    elements.backButton.addEventListener('click', returnToModeSelection);

    document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
            const selectedMode = card.dataset.mode;
            activateLearningMode(selectedMode);
        });
    });

    elements.fileSelector.addEventListener('change', displaySelectedFiles);
}

function isValidApiKeyFormat(key) {
    return key && key.length > 20 && key.length < 200 && /^[A-Za-z0-9_-]+$/.test(key);
}

async function validateAndStoreKey() {
    const enteredKey = elements.apiInput.value.trim();
    
    if (!enteredKey) {
        showValidationResult('Please enter an API key', false);
        return;
    }

    if (!isValidApiKeyFormat(enteredKey)) {
        showValidationResult('Invalid API key format. Keys should only contain letters, numbers, hyphens, and underscores.', false);
        return;
    }

    elements.validateButton.disabled = true;
    elements.validateButton.textContent = 'Validating...';

    try {
        const validationResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${primaryModel}?key=${enteredKey}`
        );

        if (validationResponse.ok) {
            localStorage.setItem(storageIdentifier, enteredKey);
            showValidationResult('API key validated successfully!', true);
            
            setTimeout(() => {
                elements.apiModal.classList.add('hidden');
                elements.mainApplication.classList.remove('hidden');
            }, 1000);
        } else if (validationResponse.status === 404) {
            const fallbackValidation = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}?key=${enteredKey}`
            );
            
            if (fallbackValidation.ok) {
                activeModelName = fallbackModel;
                localStorage.setItem(storageIdentifier, enteredKey);
                showValidationResult('API key validated! Using fallback model.', true);
                
                setTimeout(() => {
                    elements.apiModal.classList.add('hidden');
                    elements.mainApplication.classList.remove('hidden');
                }, 1000);
            } else {
                throw new Error('Invalid API key or no access to models');
            }
        } else {
            throw new Error('Invalid API key or insufficient permissions');
        }
    } catch (error) {
        showValidationResult(`Validation failed: ${error.message}`, false);
    } finally {
        elements.validateButton.disabled = false;
        elements.validateButton.textContent = 'Validate & Continue';
    }
}

function showValidationResult(message, isSuccess) {
    elements.validationDisplay.textContent = message;
    elements.validationDisplay.className = isSuccess ? 'success' : 'error';
}

function promptForNewKey() {
    localStorage.removeItem(storageIdentifier);
    elements.mainApplication.classList.add('hidden');
    elements.apiModal.classList.remove('hidden');
    elements.apiInput.value = '';
    elements.validationDisplay.className = '';
    elements.validationDisplay.style.display = 'none';
}

function displaySelectedFiles() {
    const selectedFiles = Array.from(elements.fileSelector.files);
    if (selectedFiles.length > 0) {
        const fileNames = selectedFiles.map(f => f.name).join(', ');
        showUploadStatus(`Selected: ${fileNames}`, true);
    }
}

async function handleContentProcessing() {
    const selectedFiles = Array.from(elements.fileSelector.files);
    const pastedText = elements.textBox.value.trim();

    if (selectedFiles.length === 0 && !pastedText) {
        showUploadStatus('Please upload files or enter text', false);
        return;
    }

    const fileSizeLimit = 20 * 1024 * 1024;
    for (const file of selectedFiles) {
        if (file.size > fileSizeLimit) {
            showUploadStatus(`File ${file.name} exceeds 20MB limit`, false);
            return;
        }
    }

    toggleLoadingScreen(true, 'Uploading and processing your content...');

    try {
        let combinedContent = '';

        if (selectedFiles.length > 0) {
            const uploadPromises = selectedFiles.map(file => uploadFileToGemini(file));
            const uploadResults = await Promise.all(uploadPromises);
            uploadedFilesRegistry.push(...uploadResults);
            combinedContent += uploadResults.map(f => `[Uploaded file: ${f.name}]`).join('\n');
        }

        if (pastedText) {
            combinedContent += (combinedContent ? '\n\n' : '') + pastedText;
        }

        processedMaterial = {
            files: uploadedFilesRegistry,
            text: pastedText,
            combined: combinedContent
        };

        showUploadStatus('Content processed successfully!', true);
        elements.modePanel.classList.remove('hidden');
        
    } catch (error) {
        showUploadStatus(`Processing failed: ${error.message}`, false);
    } finally {
        toggleLoadingScreen(false);
    }
}

async function uploadFileToGemini(file) {
    const apiToken = localStorage.getItem(storageIdentifier);
    
    const metadataPayload = {
        file: {
            display_name: file.name
        }
    };

    const initialResponse = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiToken}`,
        {
            method: 'POST',
            headers: {
                'X-Goog-Upload-Protocol': 'resumable',
                'X-Goog-Upload-Command': 'start',
                'X-Goog-Upload-Header-Content-Length': file.size,
                'X-Goog-Upload-Header-Content-Type': file.type,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadataPayload)
        }
    );

    const uploadUrl = initialResponse.headers.get('X-Goog-Upload-URL');
    
    const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Content-Length': file.size,
            'X-Goog-Upload-Offset': '0',
            'X-Goog-Upload-Command': 'upload, finalize'
        },
        body: file
    });

    const uploadedFileData = await uploadResponse.json();
    
    let fileStatus = uploadedFileData.file.state;
    let attempts = 0;
    while (fileStatus === 'PROCESSING' && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusCheck = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${uploadedFileData.file.name}?key=${apiToken}`
        );
        const statusData = await statusCheck.json();
        fileStatus = statusData.state;
        attempts++;
    }

    if (fileStatus !== 'ACTIVE') {
        throw new Error(`File processing failed for ${file.name}`);
    }

    return uploadedFileData.file;
}

function showUploadStatus(message, isSuccess) {
    elements.uploadDisplay.textContent = message;
    elements.uploadDisplay.className = isSuccess ? 'success' : 'error';
}

function activateLearningMode(mode) {
    currentActiveLearningMode = mode;
    elements.modePanel.classList.add('hidden');
    elements.contentPanel.classList.remove('hidden');

    const modeTitles = {
        study: 'Study Mode',
        exam: 'Exam Mode',
        flashcard: 'Flashcard Mode'
    };
    elements.modeTitle.textContent = modeTitles[mode];

    if (mode === 'study') {
        generateStudyMaterial();
    } else if (mode === 'exam') {
        generateExamQuestions();
    } else if (mode === 'flashcard') {
        generateFlashcards();
    }
}

function returnToModeSelection() {
    elements.contentPanel.classList.add('hidden');
    elements.modePanel.classList.remove('hidden');
    elements.contentRenderer.innerHTML = '';
}

async function generateStudyMaterial() {
    toggleLoadingScreen(true, 'Generating comprehensive study material...');

    try {
        const studyPrompt = `Analyze the following content and create a comprehensive study guide. Include:
1. Main concepts and key points
2. Detailed explanations
3. Important definitions
4. Summary of critical information

Use markdown formatting for better readability (bold, italics, lists, etc.).

Content to analyze:
${processedMaterial.combined}`;

        const response = await callGeminiAPI(studyPrompt, processedMaterial.files);
        
        elements.contentRenderer.innerHTML = `
            <div class="study-content">
                ${convertMarkdownToHTML(response)}
            </div>
        `;
    } catch (error) {
        elements.contentRenderer.innerHTML = `<p style="color: var(--danger);">Error: ${error.message}</p>`;
    } finally {
        toggleLoadingScreen(false);
    }
}

async function generateExamQuestions() {
    toggleLoadingScreen(true, 'Creating exam questions...');

    try {
        const examPrompt = `Based on this content, generate 5 challenging exam-style questions. For each question:
1. Ask a thought-provoking question that tests deep understanding
2. Provide the model answer after the user responds

Content:
${processedMaterial.combined}

Format your response as:
Q1: [question]
---
Q2: [question]
---
(etc.)`;

        const response = await callGeminiAPI(examPrompt, processedMaterial.files);
        const questions = response.split('---').filter(q => q.trim());
        
        window.examQuestions = questions.map(q => q.replace(/Q\d+:\s*/, '').trim());
        window.currentExamIndex = 0;
        window.examScore = 0;
        window.examAttempted = 0;
        
        renderExamInterface();
    } catch (error) {
        elements.contentRenderer.innerHTML = `<p style="color: var(--danger);">Error: ${error.message}</p>`;
    } finally {
        toggleLoadingScreen(false);
    }
}

function renderExamInterface() {
    const currentQuestion = window.examQuestions[window.currentExamIndex];
    
    elements.contentRenderer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <div style="color: var(--text-secondary);">
                Question ${window.currentExamIndex + 1} of ∞
            </div>
            <div style="background: var(--bg-card); padding: 0.75rem 1.5rem; border-radius: 8px; border: 2px solid var(--border); font-weight: 600;">
                Score: ${window.examScore}/${window.examAttempted} ${window.examAttempted > 0 ? `(${Math.round((window.examScore / window.examAttempted) * 100)}%)` : '(0%)'}
            </div>
        </div>
        <div class="exam-question">
            <h4>Question ${window.currentExamIndex + 1}</h4>
            <p>${convertMarkdownToHTML(currentQuestion)}</p>
            <textarea placeholder="Your answer..." rows="6" id="currentExamAnswer"></textarea>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button class="btn-primary" style="flex: 1;" onclick="submitCurrentExamAnswer()">Submit Answer</button>
                <button class="btn-secondary" onclick="skipExamQuestion()">Skip →</button>
            </div>
            <div id="currentExamFeedback" class="exam-feedback hidden"></div>
        </div>
    `;
}

async function submitCurrentExamAnswer() {
    const userAnswer = document.getElementById('currentExamAnswer').value.trim();
    const feedbackElement = document.getElementById('currentExamFeedback');
    const submitBtn = document.querySelector('.exam-question .btn-primary');
    
    if (!userAnswer) {
        feedbackElement.textContent = 'Please provide an answer';
        feedbackElement.classList.remove('hidden');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Evaluating...';
    toggleLoadingScreen(true, 'Evaluating your answer...');

    try {
        const evaluationPrompt = `Review this exam answer. Respond in this exact format:

RESULT: [CORRECT/PARTIALLY CORRECT/INCORRECT]

If CORRECT: Briefly explain why it's right (2-3 sentences).
If INCORRECT or PARTIALLY CORRECT: 
- What's wrong or missing (be specific)
- The correct answer with explanation

Question: ${window.examQuestions[window.currentExamIndex]}
Student Answer: ${userAnswer}

Context:
${processedMaterial.combined}`;

        const feedback = await callGeminiAPI(evaluationPrompt, []);
        
        const isCorrect = feedback.toUpperCase().includes('RESULT: CORRECT') && 
                         !feedback.toUpperCase().includes('RESULT: PARTIALLY') &&
                         !feedback.toUpperCase().includes('RESULT: INCORRECT');
        
        window.examAttempted++;
        if (isCorrect) {
            window.examScore++;
        }
        
        feedbackElement.innerHTML = `${convertMarkdownToHTML(feedback)}`;
        feedbackElement.classList.remove('hidden');
        
        submitBtn.textContent = 'Next Question →';
        submitBtn.onclick = moveToNextExamQuestion;
        
    } catch (error) {
        feedbackElement.innerHTML = `<span style="color: var(--danger);">Error: ${error.message}</span>`;
        feedbackElement.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Answer';
    } finally {
        toggleLoadingScreen(false);
    }
}

async function moveToNextExamQuestion() {
    window.currentExamIndex++;
    
    if (window.currentExamIndex >= window.examQuestions.length) {
        toggleLoadingScreen(true, 'Generating more questions...');
        
        try {
            const examPrompt = `Based on this content, generate 5 MORE challenging exam-style questions that are DIFFERENT from previous ones. Focus on different aspects and concepts.

Content:
${processedMaterial.combined}

Format your response as:
Q1: [question]
---
Q2: [question]
---
(etc.)`;

            const response = await callGeminiAPI(examPrompt, processedMaterial.files);
            const newQuestions = response.split('---').filter(q => q.trim()).map(q => q.replace(/Q\d+:\s*/, '').trim());
            
            window.examQuestions.push(...newQuestions);
        } catch (error) {
            elements.contentRenderer.innerHTML = `<p style="color: var(--danger);">Error generating more questions: ${error.message}</p>`;
            return;
        } finally {
            toggleLoadingScreen(false);
        }
    }
    
    renderExamInterface();
}

function skipExamQuestion() {
    window.currentExamIndex++;
    
    if (window.currentExamIndex >= window.examQuestions.length) {
        toggleLoadingScreen(true, 'Generating more questions...');
        
        callGeminiAPI(`Based on this content, generate 5 MORE challenging exam-style questions that are DIFFERENT from previous ones.

Content:
${processedMaterial.combined}

Format: Q1: [question]
---
Q2: [question]
---`, processedMaterial.files)
            .then(response => {
                const newQuestions = response.split('---').filter(q => q.trim()).map(q => q.replace(/Q\d+:\s*/, '').trim());
                window.examQuestions.push(...newQuestions);
                renderExamInterface();
            })
            .catch(error => {
                elements.contentRenderer.innerHTML = `<p style="color: var(--danger);">Error: ${error.message}</p>`;
            })
            .finally(() => {
                toggleLoadingScreen(false);
            });
    } else {
        renderExamInterface();
    }
}

async function generateFlashcards() {
    toggleLoadingScreen(true, 'Creating flashcards...');

    try {
        const flashcardPrompt = `Create 15 flashcards from this content. For each card:
- Front: A question or term
- Back: The answer or definition

Also create 15 multiple choice questions with 4 options each, marking the correct answer with explanation.

Content:
${processedMaterial.combined}

Format flashcards as:
CARD1-FRONT: [question]
CARD1-BACK: [answer]
---
CARD2-FRONT: [question]
CARD2-BACK: [answer]
---

Format MCQs as:
MCQ1: [question]
A) [option]
B) [option]
C) [option]
D) [option]
CORRECT: [A/B/C/D]
EXPLANATION: [why this is correct]
---`;

        const response = await callGeminiAPI(flashcardPrompt, processedMaterial.files);
        
        const parts = response.split('MCQ1:');
        const flashcardSection = parts[0];
        const mcqSection = parts[1] ? 'MCQ1:' + parts[1] : '';

        const flashcards = flashcardSection
            .split('---')
            .filter(card => card.trim())
            .map(card => {
                const lines = card.split('\n').filter(l => l.trim());
                const front = lines.find(l => l.includes('FRONT:'))?.split('FRONT:')[1]?.trim() || '';
                const back = lines.find(l => l.includes('BACK:'))?.split('BACK:')[1]?.trim() || '';
                return { front, back };
            });

        const mcqs = mcqSection
            .split('---')
            .filter(q => q.trim())
            .map(q => {
                const lines = q.split('\n').filter(l => l.trim());
                const question = lines[0]?.replace(/MCQ\d+:\s*/, '').trim() || '';
                const options = lines.filter(l => /^[A-D]\)/.test(l.trim()));
                const correct = lines.find(l => l.includes('CORRECT:'))?.split('CORRECT:')[1]?.trim() || '';
                const explanation = lines.find(l => l.includes('EXPLANATION:'))?.split('EXPLANATION:')[1]?.trim() || '';
                return { question, options, correct, explanation };
            });

        window.flashcardData = flashcards;
        window.mcqData = mcqs;
        window.currentCardIndex = 0;
        window.currentMCQIndex = 0;
        window.mcqScore = 0;
        window.mcqAttempted = 0;

        renderFlashcardInterface();
    } catch (error) {
        elements.contentRenderer.innerHTML = `<p style="color: var(--danger);">Error: ${error.message}</p>`;
    } finally {
        toggleLoadingScreen(false);
    }
}

function renderFlashcardInterface() {
    elements.contentRenderer.innerHTML = `
        <div class="flashcard-container">
            <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div style="text-align: center; flex: 1;">
                    <button class="btn-secondary" onclick="switchToFlashcards()">Flashcards</button>
                    <button class="btn-secondary" onclick="switchToMCQ()">Multiple Choice</button>
                </div>
                <div id="scoreDisplay"></div>
            </div>
            <div id="flashcardView"></div>
        </div>
    `;
    
    switchToFlashcards();
}

function switchToFlashcards() {
    const view = document.getElementById('flashcardView');
    const card = window.flashcardData[window.currentCardIndex];
    
    updateScoreDisplay();
    
    view.innerHTML = `
        <div style="text-align: center; color: var(--text-secondary); margin-bottom: 1rem;">
            Flashcard ${window.currentCardIndex + 1} of ${window.flashcardData.length}
        </div>
        <div class="flashcard" onclick="flipCard()" id="currentCard">
            <div class="flashcard-content" id="cardContent">${card.front}</div>
        </div>
        <div class="flashcard-controls">
            <button class="btn-secondary" onclick="previousCard()">← Previous</button>
            <button class="btn-primary" onclick="flipCard()">Flip Card</button>
            <button class="btn-secondary" onclick="nextCard()">Next →</button>
        </div>
    `;
}

function switchToMCQ() {
    const view = document.getElementById('flashcardView');
    const mcq = window.mcqData[window.currentMCQIndex];
    
    updateScoreDisplay();
    
    view.innerHTML = `
        <div style="text-align: center; color: var(--text-secondary); margin-bottom: 1rem;">
            Question ${window.currentMCQIndex + 1} of ${window.mcqData.length}
        </div>
        <div style="background: var(--bg-card); padding: 2rem; border-radius: 12px; border: 2px solid var(--border);">
            <h3 style="margin-bottom: 1.5rem; color: var(--primary);">${mcq.question}</h3>
            <div class="mcq-options" id="mcqOptions">
                ${mcq.options.map((opt, idx) => `
                    <div class="mcq-option" onclick="selectMCQOption(${idx})" data-option="${opt.charAt(0)}">
                        ${opt}
                    </div>
                `).join('')}
            </div>
            <button class="btn-primary" style="margin-top: 1rem; width: 100%;" onclick="submitMCQAnswer()">Submit Answer</button>
            <div id="mcqFeedback" style="margin-top: 1rem;"></div>
        </div>
        <div class="flashcard-controls" style="margin-top: 1rem;">
            <button class="btn-secondary" onclick="previousMCQ()">← Previous</button>
            <button class="btn-secondary" onclick="nextMCQ()">Next →</button>
        </div>
    `;
}

let cardFlipped = false;
function flipCard() {
    const card = document.getElementById('currentCard');
    const content = document.getElementById('cardContent');
    const currentCard = window.flashcardData[window.currentCardIndex];
    
    cardFlipped = !cardFlipped;
    content.textContent = cardFlipped ? currentCard.back : currentCard.front;
    card.classList.toggle('flipped');
}

function nextCard() {
    window.currentCardIndex = (window.currentCardIndex + 1) % window.flashcardData.length;
    cardFlipped = false;
    switchToFlashcards();
}

function previousCard() {
    window.currentCardIndex = (window.currentCardIndex - 1 + window.flashcardData.length) % window.flashcardData.length;
    cardFlipped = false;
    switchToFlashcards();
}

let selectedOption = null;
let mcqAnswered = false;

function selectMCQOption(optionIndex) {
    if (mcqAnswered) return;
    
    document.querySelectorAll('.mcq-option').forEach(opt => opt.classList.remove('selected'));
    const options = document.querySelectorAll('.mcq-option');
    options[optionIndex].classList.add('selected');
    selectedOption = options[optionIndex].dataset.option;
}

function submitMCQAnswer() {
    if (mcqAnswered) return;
    
    const mcq = window.mcqData[window.currentMCQIndex];
    const feedback = document.getElementById('mcqFeedback');
    
    if (!selectedOption) {
        feedback.innerHTML = '<p style="color: var(--warning);">Please select an option</p>';
        return;
    }

    mcqAnswered = true;
    window.mcqAttempted++;

    const options = document.querySelectorAll('.mcq-option');
    const isCorrect = selectedOption === mcq.correct;
    
    if (isCorrect) {
        window.mcqScore++;
        options.forEach(opt => {
            if (opt.dataset.option === mcq.correct) {
                opt.classList.add('correct');
            }
        });
        feedback.innerHTML = '<p style="color: var(--success); font-weight: 600;">✓ Correct!</p>';
    } else {
        options.forEach(opt => {
            if (opt.dataset.option === mcq.correct) {
                opt.classList.add('correct');
            } else if (opt.dataset.option === selectedOption) {
                opt.classList.add('incorrect');
            }
        });
        feedback.innerHTML = `<p style="color: var(--danger); font-weight: 600;">✗ Incorrect</p><p style="margin-top: 0.5rem;">${convertMarkdownToHTML(mcq.explanation)}</p>`;
    }
    
    updateScoreDisplay();
}

function nextMCQ() {
    window.currentMCQIndex = (window.currentMCQIndex + 1) % window.mcqData.length;
    selectedOption = null;
    mcqAnswered = false;
    switchToMCQ();
}

function previousMCQ() {
    window.currentMCQIndex = (window.currentMCQIndex - 1 + window.mcqData.length) % window.mcqData.length;
    selectedOption = null;
    mcqAnswered = false;
    switchToMCQ();
}

function updateScoreDisplay() {
    const scoreElement = document.getElementById('scoreDisplay');
    if (scoreElement && window.mcqAttempted > 0) {
        const percentage = Math.round((window.mcqScore / window.mcqAttempted) * 100);
        scoreElement.innerHTML = `Score: ${window.mcqScore}/${window.mcqAttempted} <span style="color: var(--primary);">(${percentage}%)</span>`;
    } else if (scoreElement) {
        scoreElement.innerHTML = 'Score: 0/0 (0%)';
    }
}

async function callGeminiAPI(promptText, fileReferences = []) {
    const apiToken = localStorage.getItem(storageIdentifier);
    
    if (!apiToken || !isValidApiKeyFormat(apiToken)) {
        throw new Error('Invalid or missing API key. Please re-enter your API key.');
    }
    
    const contentParts = [];
    
    fileReferences.forEach(file => {
        contentParts.push({
            file_data: {
                mime_type: file.mimeType,
                file_uri: file.uri
            }
        });
    });
    
    contentParts.push({ text: promptText });

    const requestPayload = {
        contents: [{
            parts: contentParts
        }],
        generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192
        }
    };

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${activeModelName}:generateContent?key=${apiToken}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestPayload)
            }
        );

        if (!response.ok) {
            if (activeModelName === primaryModel && response.status === 404) {
                activeModelName = fallbackModel;
                return callGeminiAPI(promptText, fileReferences);
            }
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        throw new Error(`Gemini API error: ${error.message}`);
    }
}

function convertMarkdownToHTML(text) {
    let html = text;
    
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    
    html = html.replace(/`(.+?)`/g, '<code style="background: var(--bg-hover); padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace;">$1</code>');
    
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h3>$1</h3>');
    
    const lines = html.split('\n');
    let formatted = '';
    let inList = false;
    let inOrderedList = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (!line) {
            if (inList) {
                formatted += '</ul>';
                inList = false;
            }
            if (inOrderedList) {
                formatted += '</ol>';
                inOrderedList = false;
            }
            continue;
        }
        
        if (line.match(/^[-*•]\s/)) {
            if (!inList) {
                formatted += '<ul>';
                inList = true;
            }
            formatted += `<li>${line.replace(/^[-*•]\s/, '')}</li>`;
        } else if (line.match(/^\d+\.\s/)) {
            if (!inOrderedList) {
                formatted += '<ol>';
                inOrderedList = true;
            }
            formatted += `<li>${line.replace(/^\d+\.\s/, '')}</li>`;
        } else {
            if (inList) {
                formatted += '</ul>';
                inList = false;
            }
            if (inOrderedList) {
                formatted += '</ol>';
                inOrderedList = false;
            }
            
            if (!line.startsWith('<h3>')) {
                formatted += `<p>${line}</p>`;
            } else {
                formatted += line;
            }
        }
    }
    
    if (inList) formatted += '</ul>';
    if (inOrderedList) formatted += '</ol>';
    
    return formatted;
}

function toggleLoadingScreen(show, message = 'Processing...') {
    if (show) {
        elements.loadingMessage.textContent = message;
        elements.loadingScreen.classList.remove('hidden');
    } else {
        elements.loadingScreen.classList.add('hidden');
    }
}

window.flipCard = flipCard;
window.nextCard = nextCard;
window.previousCard = previousCard;
window.switchToFlashcards = switchToFlashcards;
window.switchToMCQ = switchToMCQ;
window.selectMCQOption = selectMCQOption;
window.submitMCQAnswer = submitMCQAnswer;
window.nextMCQ = nextMCQ;
window.previousMCQ = previousMCQ;
window.submitCurrentExamAnswer = submitCurrentExamAnswer;
window.moveToNextExamQuestion = moveToNextExamQuestion;
window.skipExamQuestion = skipExamQuestion;

document.addEventListener('DOMContentLoaded', initializeApplication);
