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
    toggleLoadingScreen(true, 'Creating exam content...');

    try {
        // Generate both open-ended questions and MCQs
        const examPrompt = `Generate exam content with:

1. 5 challenging open-ended questions
2. 15 multiple choice questions with 4 options each

Content:
${processedMaterial.combined}

CRITICAL: Separate each question with --- on a new line.

For OPEN-ENDED questions, format EXACTLY as:
Q1: [question text]
---
Q2: [question text]
---
Q3: [question text]
---
(continue for all 5 questions)

For MULTIPLE CHOICE questions, format EXACTLY as:
MCQ1: [question text]
A) [option]
B) [option]
C) [option]
D) [option]
CORRECT: [letter]
EXPLANATION: [brief explanation]
---
MCQ2: [question text]
(continue for all 15 questions)

Do NOT include any preamble text. Just provide the questions directly.`;

        const response = await callGeminiAPI(examPrompt, processedMaterial.files);
        
        // Clean up any preamble
        let cleanedResponse = response;
        const preambles = [
            /^.*?(?:here are|okay,?\s*here are).*?questions.*?$/im,
            /^.*?based on.*?content.*?$/im,
            /^.*?following questions.*?$/im
        ];
        preambles.forEach(pattern => {
            cleanedResponse = cleanedResponse.replace(pattern, '');
        });
        
        // Split into open-ended and MCQ sections - look for MCQ1: or just the first MCQ pattern
        let openEndedSection = cleanedResponse;
        let mcqSection = '';
        
        // Try to find where MCQs start
        const mcqStartMatch = cleanedResponse.match(/MCQ1:/i);
        if (mcqStartMatch) {
            openEndedSection = cleanedResponse.substring(0, mcqStartMatch.index);
            mcqSection = cleanedResponse.substring(mcqStartMatch.index);
        }
        
        // Parse open-ended questions - handle both --- separator and Q1:/Q2: format
        let openEndedQuestions = [];
        
        // First try splitting by ---
        if (openEndedSection.includes('---')) {
            openEndedQuestions = openEndedSection
                .split('---')
                .filter(q => q.trim())
                .map(q => q.replace(/Q\d+:\s*/i, '').trim())
                .filter(q => q.length > 0 && !q.match(/^[A-D]\)/)); // Exclude MCQ options
        } else {
            // If no ---, split by Q1:, Q2:, Q3:, etc.
            const questionMatches = openEndedSection.match(/Q\d+:[\s\S]*?(?=Q\d+:|$)/gi);
            if (questionMatches) {
                openEndedQuestions = questionMatches
                    .map(q => {
                        // Remove MCQ options if they snuck in
                        let cleaned = q.replace(/Q\d+:\s*/i, '').trim();
                        // Stop at first MCQ-style option
                        const mcqMatch = cleaned.match(/\n[A-D]\)/);
                        if (mcqMatch) {
                            cleaned = cleaned.substring(0, mcqMatch.index).trim();
                        }
                        return cleaned;
                    })
                    .filter(q => q.length > 0);
            } else {
                // Fallback: treat entire section as one question
                let cleaned = openEndedSection.replace(/Q\d+:\s*/i, '').trim();
                // Stop at first MCQ-style option
                const mcqMatch = cleaned.match(/\n[A-D]\)/);
                if (mcqMatch) {
                    cleaned = cleaned.substring(0, mcqMatch.index).trim();
                }
                if (cleaned.length > 0) {
                    openEndedQuestions = [cleaned];
                }
            }
        }
        
        // Parse MCQs
        const mcqs = mcqSection
            .split('---')
            .filter(q => q.trim())
            .map(q => {
                const lines = q.split('\n').filter(l => l.trim());
                const question = lines[0]?.replace(/MCQ\d+:\s*/i, '').trim() || '';
                const options = lines.filter(l => /^[A-D]\)/i.test(l.trim()));
                const correctMatch = q.match(/CORRECT:\s*([A-D])/i);
                const correct = correctMatch ? correctMatch[1].toUpperCase() : '';
                const explanationMatch = q.match(/EXPLANATION:\s*(.+)/i);
                const explanation = explanationMatch ? explanationMatch[1].trim() : '';
                return { question, options, correct, explanation };
            })
            .filter(mcq => mcq.question && mcq.options.length > 0);
        
        window.examQuestions = openEndedQuestions;
        window.examMCQs = mcqs;
        window.currentExamIndex = 0;
        window.examScore = 0;
        window.examAttempted = 0;
        window.currentExamMCQIndex = 0;
        window.examMCQScore = 0;
        window.examMCQAttempted = 0;
        
        renderExamModeSelection();
    } catch (error) {
        elements.contentRenderer.innerHTML = `<p style="color: var(--danger);">Error: ${error.message}</p>`;
    } finally {
        toggleLoadingScreen(false);
    }
}

function renderExamModeSelection() {
    elements.contentRenderer.innerHTML = `
        <div style="text-align: center; margin-bottom: 2rem;">
            <h3 style="margin-bottom: 1.5rem; font-size: 1.5rem; text-transform: uppercase; letter-spacing: -1px;">Choose Exam Type</h3>
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                <button class="btn-primary" onclick="startOpenEndedExam()" style="min-width: 200px;">
                    Open-Ended Questions
                    <div style="font-size: 0.85rem; margin-top: 0.25rem; opacity: 0.9;">Written responses with AI evaluation</div>
                </button>
                <button class="btn-secondary" onclick="startMCQExam()" style="min-width: 200px;">
                    Multiple Choice
                    <div style="font-size: 0.85rem; margin-top: 0.25rem; opacity: 0.9;">15 questions with instant feedback</div>
                </button>
            </div>
        </div>
    `;
}

function startOpenEndedExam() {
    window.currentExamMode = 'open-ended';
    renderExamInterface();
}

function startMCQExam() {
    window.currentExamMode = 'mcq';
    window.currentExamMCQIndex = 0;
    window.examMCQScore = 0;
    window.examMCQAttempted = 0;
    window.examMCQAnswered = false;
    renderExamMCQInterface();
}

function renderExamInterface() {
    const currentQuestion = window.examQuestions[window.currentExamIndex];
    
    // Open-ended question only
    window.currentExamType = 'open';
    
    elements.contentRenderer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <button class="btn-secondary" onclick="renderExamModeSelection()">← Back to Exam Types</button>
            <div style="color: var(--text-secondary);">
                Question ${window.currentExamIndex + 1} of ∞
            </div>
            <div style="background: var(--bg-card); padding: 0.75rem 1.5rem; border: 2px solid var(--border); font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
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

function renderExamMCQInterface() {
    // Check if exam is complete
    if (window.currentExamMCQIndex >= window.examMCQs.length) {
        showMCQFinalScore();
        return;
    }
    
    const mcq = window.examMCQs[window.currentExamMCQIndex];
    const totalQuestions = window.examMCQs.length;
    
    elements.contentRenderer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <button class="btn-secondary" onclick="renderExamModeSelection()">← Back to Exam Types</button>
            <div style="color: var(--text-secondary);">
                Question ${window.currentExamMCQIndex + 1} of ${totalQuestions}
            </div>
            <div style="background: var(--bg-card); padding: 0.75rem 1.5rem; border: 2px solid var(--border); font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                Score: ${window.examMCQScore}/${totalQuestions} (${Math.round((window.examMCQScore / totalQuestions) * 100)}%)
            </div>
        </div>
        <div class="exam-question">
            <h4>Question ${window.currentExamMCQIndex + 1}</h4>
            <p>${convertMarkdownToHTML(mcq.question)}</p>
            <div class="mcq-options" id="examMCQOptions">
                ${mcq.options.map((opt, idx) => `
                    <div class="mcq-option" data-option="${opt.charAt(0)}" onclick="selectExamMCQOption(${idx})">
                        ${opt}
                    </div>
                `).join('')}
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button class="btn-primary" style="flex: 1;" onclick="submitExamMCQAnswer()">Submit Answer</button>
                <button class="btn-secondary" onclick="skipExamMCQQuestion()">Skip →</button>
            </div>
            <div id="examMCQFeedback" class="exam-feedback hidden"></div>
        </div>
    `;
}

function showMCQFinalScore() {
    const totalQuestions = window.examMCQs.length;
    const percentage = Math.round((window.examMCQScore / totalQuestions) * 100);
    
    elements.contentRenderer.innerHTML = `
        <div style="text-align: center; padding: 3rem;">
            <h2 style="font-size: 3rem; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: -2px;">Exam Complete!</h2>
            <div style="font-size: 4rem; font-weight: bold; margin: 2rem 0; color: var(--accent);">
                ${window.examMCQScore}/${totalQuestions}
            </div>
            <div style="font-size: 2rem; margin-bottom: 3rem; text-transform: uppercase; letter-spacing: 2px;">
                ${percentage}% CORRECT
            </div>
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                <button class="btn-primary" onclick="retakeMCQExam()" style="min-width: 200px;">
                    Retake Exam
                </button>
                <button class="btn-secondary" onclick="renderExamModeSelection()" style="min-width: 200px;">
                    Back to Exam Types
                </button>
            </div>
        </div>
    `;
}

function retakeMCQExam() {
    window.currentExamMCQIndex = 0;
    window.examMCQScore = 0;
    window.examMCQAttempted = 0;
    window.examMCQAnswered = false;
    renderExamMCQInterface();
}

function selectExamMCQOption(optionIndex) {
    if (window.examMCQAnswered) return;
    
    document.querySelectorAll('#examMCQOptions .mcq-option').forEach(opt => opt.classList.remove('selected'));
    const options = document.querySelectorAll('#examMCQOptions .mcq-option');
    options[optionIndex].classList.add('selected');
    window.examMCQSelectedOption = options[optionIndex].dataset.option;
}

function submitExamMCQAnswer() {
    if (window.examMCQAnswered) {
        // Move to next question
        nextExamMCQQuestion();
        return;
    }
    
    const mcq = window.examMCQs[window.currentExamMCQIndex];
    const feedback = document.getElementById('examMCQFeedback');
    const submitBtn = document.querySelector('.exam-question .btn-primary');
    
    if (!window.examMCQSelectedOption) {
        feedback.textContent = 'Please select an answer';
        feedback.classList.remove('hidden');
        return;
    }
    
    window.examMCQAnswered = true;
    window.examMCQAttempted++;
    
    const options = document.querySelectorAll('#examMCQOptions .mcq-option');
    const isCorrect = window.examMCQSelectedOption === mcq.correct;
    
    if (isCorrect) {
        window.examMCQScore++;
        options.forEach(opt => {
            opt.style.pointerEvents = 'none';
            if (opt.dataset.option === mcq.correct) {
                opt.classList.add('correct');
            }
        });
        feedback.innerHTML = '<strong>CORRECT!</strong> Well done!';
        feedback.classList.remove('hidden');
    } else {
        options.forEach(opt => {
            opt.style.pointerEvents = 'none';
            if (opt.dataset.option === mcq.correct) {
                opt.classList.add('correct');
            } else if (opt.dataset.option === window.examMCQSelectedOption) {
                opt.classList.add('incorrect');
            }
        });
        feedback.innerHTML = `<strong>INCORRECT.</strong> The correct answer is <strong>${mcq.correct}</strong>.<br><br>${convertMarkdownToHTML(mcq.explanation)}`;
        feedback.classList.remove('hidden');
    }
    
    submitBtn.textContent = 'Next Question →';
}

function nextExamMCQQuestion() {
    window.currentExamMCQIndex++;
    window.examMCQAnswered = false;
    window.examMCQSelectedOption = null;
    renderExamMCQInterface();
}

function skipExamMCQQuestion() {
    window.examMCQAttempted++;
    nextExamMCQQuestion();
}

function selectExamMCQ(letter) {
    window.currentExamSelected = letter;
    const options = document.querySelectorAll('#examMCQOptions .mcq-option');
    options.forEach(opt => {
        opt.classList.remove('selected');
        if (opt.dataset.answer === letter) {
            opt.classList.add('selected');
        }
    });
}

async function submitCurrentExamAnswer() {
    const feedbackElement = document.getElementById('currentExamFeedback');
    const submitBtn = document.querySelector('.exam-question .btn-primary');
    
    // Open-ended question only
    const answerTextarea = document.getElementById('currentExamAnswer');
    const userAnswer = answerTextarea ? answerTextarea.value.trim() : '';
    
    if (!userAnswer) {
        feedbackElement.textContent = 'Please provide an answer';
        feedbackElement.classList.remove('hidden');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Evaluating...';
    toggleLoadingScreen(true, 'Evaluating your answer...');

    try {
        const evaluationPrompt = `Review this exam answer. Do NOT include preamble text. Respond in this exact format:

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
    
    // Check if we need to generate more questions (when we're near the end)
    if (window.currentExamIndex >= window.examQuestions.length - 2) {
        toggleLoadingScreen(true, 'Generating more questions...');
        
        try {
            const examPrompt = `Generate 5 MORE challenging open-ended questions that are DIFFERENT from previous ones.

Content:
${processedMaterial.combined}

CRITICAL: Separate each question with --- on a new line.

Format EXACTLY as:
Q1: [question text]
---
Q2: [question text]
---
Q3: [question text]
---
Q4: [question text]
---
Q5: [question text]
---

Do NOT include any preamble text. Just provide the questions directly.`;

            const response = await callGeminiAPI(examPrompt, processedMaterial.files);
            
            // Clean up any preamble
            let cleanedResponse = response;
            const preambles = [
                /^.*?(?:here are|okay,?\s*here are).*?questions.*?$/im,
                /^.*?based on.*?content.*?$/im,
                /^.*?following questions.*?$/im
            ];
            preambles.forEach(pattern => {
                cleanedResponse = cleanedResponse.replace(pattern, '');
            });
            
            // Parse questions - handle both --- separator and Q1:/Q2: format
            let newQuestions = [];
            if (cleanedResponse.includes('---')) {
                newQuestions = cleanedResponse.split('---')
                    .filter(q => q.trim())
                    .map(q => {
                        let cleaned = q.replace(/Q\d+:\s*/i, '').trim();
                        // Stop at first MCQ-style option
                        const mcqMatch = cleaned.match(/\n[A-D]\)/);
                        if (mcqMatch) {
                            cleaned = cleaned.substring(0, mcqMatch.index).trim();
                        }
                        return cleaned;
                    });
            } else {
                const questionMatches = cleanedResponse.match(/Q\d+:[\s\S]*?(?=Q\d+:|$)/gi);
                if (questionMatches) {
                    newQuestions = questionMatches.map(q => {
                        let cleaned = q.replace(/Q\d+:\s*/i, '').trim();
                        // Stop at first MCQ-style option
                        const mcqMatch = cleaned.match(/\n[A-D]\)/);
                        if (mcqMatch) {
                            cleaned = cleaned.substring(0, mcqMatch.index).trim();
                        }
                        return cleaned;
                    });
                }
            }
            
            window.examQuestions.push(...newQuestions.filter(q => q.length > 0));
        } catch (error) {
            elements.contentRenderer.innerHTML = `<p style="color: var(--danger);">Error generating more questions: ${error.message}</p>`;
            toggleLoadingScreen(false);
            return;
        } finally {
            toggleLoadingScreen(false);
        }
    }
    
    renderExamInterface();
}

function skipExamQuestion() {
    window.currentExamIndex++;
    
    // Check if we need to generate more questions (when we're near the end)
    if (window.currentExamIndex >= window.examQuestions.length - 2) {
        toggleLoadingScreen(true, 'Generating more questions...');
        
        callGeminiAPI(`Generate 5 MORE challenging open-ended questions that are DIFFERENT from previous ones.

Content:
${processedMaterial.combined}

CRITICAL: Separate each question with --- on a new line.

Format EXACTLY as:
Q1: [question]
---
Q2: [question]
---
Q3: [question]
---
Q4: [question]
---
Q5: [question]
---

No preamble text.`, processedMaterial.files)
            .then(response => {
                // Clean up any preamble
                let cleanedResponse = response;
                const preambles = [
                    /^.*?(?:here are|okay,?\s*here are).*?questions.*?$/im,
                    /^.*?based on.*?content.*?$/im,
                    /^.*?following questions.*?$/im
                ];
                preambles.forEach(pattern => {
                    cleanedResponse = cleanedResponse.replace(pattern, '');
                });
                
                // Parse questions - handle both --- separator and Q1:/Q2: format
                let newQuestions = [];
                if (cleanedResponse.includes('---')) {
                    newQuestions = cleanedResponse.split('---')
                        .filter(q => q.trim())
                        .map(q => {
                            let cleaned = q.replace(/Q\d+:\s*/i, '').trim();
                            // Stop at first MCQ-style option
                            const mcqMatch = cleaned.match(/\n[A-D]\)/);
                            if (mcqMatch) {
                                cleaned = cleaned.substring(0, mcqMatch.index).trim();
                            }
                            return cleaned;
                        });
                } else {
                    const questionMatches = cleanedResponse.match(/Q\d+:[\s\S]*?(?=Q\d+:|$)/gi);
                    if (questionMatches) {
                        newQuestions = questionMatches.map(q => {
                            let cleaned = q.replace(/Q\d+:\s*/i, '').trim();
                            // Stop at first MCQ-style option
                            const mcqMatch = cleaned.match(/\n[A-D]\)/);
                            if (mcqMatch) {
                                cleaned = cleaned.substring(0, mcqMatch.index).trim();
                            }
                            return cleaned;
                        });
                    }
                }
                
                window.examQuestions.push(...newQuestions.filter(q => q.length > 0));
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
        const flashcardPrompt = `Create 30 flashcards from this content. For each card:
- Front: A question or term
- Back: The answer or definition

Content:
${processedMaterial.combined}

Format flashcards as:
CARD1-FRONT: [question]
CARD1-BACK: [answer]
---
CARD2-FRONT: [question]
CARD2-BACK: [answer]
---

Do NOT include any preamble text.`;

        const response = await callGeminiAPI(flashcardPrompt, processedMaterial.files);
        
        const flashcards = response
            .split('---')
            .filter(card => card.trim())
            .map(card => {
                const lines = card.split('\n').filter(l => l.trim());
                const front = lines.find(l => l.includes('FRONT:'))?.split('FRONT:')[1]?.trim() || '';
                const back = lines.find(l => l.includes('BACK:'))?.split('BACK:')[1]?.trim() || '';
                return { front, back };
            })
            .filter(card => card.front && card.back);

        window.flashcardData = flashcards;
        window.currentCardIndex = 0;

        renderFlashcardInterface();
    } catch (error) {
        elements.contentRenderer.innerHTML = `<p style="color: var(--danger);">Error: ${error.message}</p>`;
    } finally {
        toggleLoadingScreen(false);
    }
}

function renderFlashcardInterface() {
    const card = window.flashcardData[window.currentCardIndex];
    
    elements.contentRenderer.innerHTML = `
        <div class="flashcard-container">
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
    renderFlashcardInterface();
}

function previousCard() {
    window.currentCardIndex = (window.currentCardIndex - 1 + window.flashcardData.length) % window.flashcardData.length;
    cardFlipped = false;
    renderFlashcardInterface();
}

async function callGeminiAPI(promptText, fileReferences = []) {
    const apiToken = localStorage.getItem(storageIdentifier);
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
    
    // Handle headings - process from h6 to h1 (most specific to least specific)
    html = html.replace(/^###### (.+)$/gm, '<h6 style="font-size: 0.95rem; font-weight: bold; margin: 0.75rem 0 0.5rem 0;">$1</h6>');
    html = html.replace(/^##### (.+)$/gm, '<h5 style="font-size: 1rem; font-weight: bold; margin: 0.75rem 0 0.5rem 0;">$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4 style="font-size: 1.1rem; font-weight: bold; margin: 1rem 0 0.5rem 0;">$1</h4>');
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
window.submitCurrentExamAnswer = submitCurrentExamAnswer;
window.moveToNextExamQuestion = moveToNextExamQuestion;
window.skipExamQuestion = skipExamQuestion;
window.startOpenEndedExam = startOpenEndedExam;
window.startMCQExam = startMCQExam;
window.renderExamModeSelection = renderExamModeSelection;
window.selectExamMCQOption = selectExamMCQOption;
window.submitExamMCQAnswer = submitExamMCQAnswer;
window.nextExamMCQQuestion = nextExamMCQQuestion;
window.skipExamMCQQuestion = skipExamMCQQuestion;
window.retakeMCQExam = retakeMCQExam;

document.addEventListener('DOMContentLoaded', initializeApplication);
