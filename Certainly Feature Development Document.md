# Certainly Feature Development Document

## 1. Feature Implementation Points

### 1.1 Forward/Backward Buttons
- **Implementation Location**: `src/components/ui/flashcard/flashcard-widget.tsx`
- **Core Functions**:
  - Add two button components at the top of the flashcard interface
  - Implement `handlePrevious` function to switch to the previous word
  - Modify the existing `handleNext` function to enable word switching in non-quiz mode
  - Add boundary check logic to control button disable state

### 1.2 Vocabulary Book Operation Optimization
- **Implementation Location**: `src/components/ui/flashcard/flashcard-widget.tsx`
- **Core Functions**:
  - Move the "Add to Vocabulary Book" button position to be alongside other operation buttons
  - Implement logic to check if a word is in the vocabulary book
  - Display corresponding button states based on the check results
  - Remove alert prompts and replace with visual feedback

### 1.3 Never Appear Again Feature
- **Implementation Location**: `src/components/ui/flashcard/flashcard-widget.tsx`
- **Core Functions**:
  - Add "Never Appear Again" button, sharing the same position with "Appear Again" button
  - Implement conditional rendering logic to display this button when the answer is shown
  - Implement `handleIgnoreWord` function to call API to mark words as ignored
  - Automatically switch to the next word after marking

### 1.4 Appear Again Feature
- **Implementation Location**:
  - `src/components/ui/flashcard/flashcard-widget.tsx` (add entry button)
  - New file `src/components/ui/flashcard/ignored-words.tsx` (implement ignored word list interface)
- **Core Functions**:
  - Add "Appear Again" button, sharing the same position with "Never Appear Again" button
  - Implement conditional rendering logic to display this button when the answer is not shown
  - Create a new dialog component to display the list of ignored words
  - Implement API calls to get the list of ignored words
  - Implement word restoration function to remove words from the ignore list when clicked

## 2. Technology Selection Basis

### 2.1 Front-end Technology Stack
- **React**: Use functional components and Hooks for state management
- **Next.js**: Project base framework
- **Tailwind CSS**: Style management
- **Lucide React**: Icon library
- **shadcn/ui**: UI component library (Button, Card, Dialog, etc.)

### 2.2 Data Management
- **State Management**: Use React useState to manage component internal state
- **API Calls**: Use fetch API for network requests
- **Session Management**: Use next-auth's useSession hook

## 3. Core Module Design Description

### 3.1 FlashcardWidget Component
- **State Management**:
  - `words`: Word list
  - `currentIndex`: Current word index
  - `showAnswer`: Whether to show the answer
  - `isLoading`: Loading state
  - `isOpen`: Whether the dialog is open
  - `isSaving`: Saving state
  - `groups`: Review group list
  - `selectedGroupId`: Currently selected review group
  - `isUpdating`: Updating state

- **Core Functions**:
  - `fetchGroups`: Get review group list
  - `fetchWords`: Get word list
  - `handleGroupChange`: Handle review group changes
  - `handleSaveToPrivate`: Save word to vocabulary book
  - `handleNext`: Handle next word
  - `handlePrevious`: Handle previous word (new)
  - `handleIgnoreWord`: Handle word ignore (new)
  - `playAudio`: Play word pronunciation

### 3.2 IgnoredWords Component (New)
- **State Management**:
  - `ignoredWords`: List of ignored words
  - `isLoading`: Loading state
  - `isRestoring`: Restoring state

- **Core Functions**:
  - `fetchIgnoredWords`: Get list of ignored words
  - `handleRestoreWord`: Restore ignored word

## 4. Interface Definition Specifications

### 4.1 Existing Interfaces
- **GET /api/review-groups**: Get review group list
- **GET /api/flashcard/public**: Get public vocabulary words
- **POST /api/dictation/update**: Update word status

### 4.2 New Interfaces
- **POST /api/flashcard/ignore**: Mark word as ignored
  - Parameters: `{ word: string }`
  - Return: `{ success: boolean, message: string }`

- **GET /api/flashcard/ignored**: Get list of ignored words
  - Parameters: None
  - Return: `{ success: boolean, data: Word[] }`

- **POST /api/flashcard/restore**: Restore ignored word
  - Parameters: `{ word: string }`
  - Return: `{ success: boolean, message: string }`

## 5. Integration Plan with Existing Code Architecture

### 5.1 FlashcardWidget Component Modification
1. **Add 前进/后退按钮**:
   - Add two Button components in the dialog title area
   - Implement `handlePrevious` function
   - Modify `handleNext` function to add non-quiz mode handling

2. **Adjust 加入生词本 Button**:
   - Move button position to the operation area
   - Add logic to check if word is in vocabulary book
   - Modify button state display
   - Remove alert prompts and replace with visual feedback

3. **Add 不再出现/再出现 Buttons**:
   - Add conditional rendering logic to display different buttons based on `showAnswer` state
   - Implement `handleIgnoreWord` function
   - Add click event for "再出现" button to open IgnoredWords dialog

### 5.2 IgnoredWords Component Creation
1. **Component Structure**:
   - Use Dialog component to create dialog
   - Use Card component to display ignored words
   - Use Button component to implement restore function

2. **Data Flow**:
   - Get list of ignored words when component mounts
   - Call API to restore word when restore button is clicked
   - Update list after successful restoration

### 5.3 API Interface Implementation
1. **Backend Routes**:
   - Create `ignore.ts`, `ignored.ts`, `restore.ts` files in `pages/api/flashcard/` directory

2. **Data Storage**:
   - Use database to store user-ignored words
   - Add ignore word association in user table

3. **Permission Control**:
   - Ensure only logged-in users can ignore and restore words

## 6. Implementation Notes

### 6.1 Performance Optimization
- **Word List Loading**: Use caching mechanism to reduce duplicate requests
- **Ignored Word List**: Implement pagination loading to avoid loading too much data at once

### 6.2 Boundary Case Handling
- **Empty Word List**: Display friendly prompt message
- **Only One Word**: Disable forward/backward buttons
- **Non-logged-in Users**: Disable features that require login and display login prompt

### 6.3 State Synchronization
- **Vocabulary Book State**: Ensure timely update of whether words are in the vocabulary book
- **Ignore State**: Ensure ignored words do not appear in word lists

### 6.4 User Experience
- **Loading State**: Add appropriate loading indicators
- **Error Handling**: Display friendly error messages
- **Animation Effects**: Add appropriate transition animations to enhance user experience

## 7. Development Plan

1. **Phase 1**: Implement forward/backward buttons functionality
2. **Phase 2**: Optimize vocabulary book operation functionality
3. **Phase 3**: Implement never appear again functionality
4. **Phase 4**: Implement appear again functionality
5. **Phase 5**: Testing and optimization

## 8. Code Architecture Diagram

```
┌─────────────────────────────────────────────┐
│ FlashcardWidget                             │
├─────────────────────────────────────────────┤
│ ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│ │ Forward/Backward Buttons │  │ Vocabulary Book │  │ Appear Again/ │ │
│ │             │  │             │  │ Never Appear Again │ │
│ └─────────────┘  └─────────────┘  └─────────┘ │
│                                               │
│ ┌───────────────────────────────────────────┐ │
│ │ Word Display Area                          │ │
│ │                                           │ │
│ │ ┌───────────────────────────────────────┐ │ │
│ │ │ Word, Phonetic, Pronunciation Button  │ │ │
│ │ └───────────────────────────────────────┘ │ │
│ │                                           │ │
│ │ ┌───────────────────────────────────────┐ │ │
│ │ │ Answer Display (Conditional Rendering) │ │ │
│ │ └───────────────────────────────────────┘ │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ ┌───────────────────────────────────────────┐ │
│ │ Operation Button Area                      │ │
│ │                                           │ │
│ │ ┌─────────────┐  ┌─────────────┐          │ │
│ │ │ Don't Know Button │  │ Know Button    │          │ │
│ │ └─────────────┘  └─────────────┘          │ │
│ └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────┐
│ IgnoredWords                                │
├─────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────┐ │
│ │ Ignored Word List                          │ │
│ │                                           │ │
│ │ ┌───────────────────────────────────────┐ │ │
│ │ │ Word Card                              │ │ │
│ │ │ Word, Phonetic, Definition            │ │ │
│ │ │ Restore Button                          │ │ │
│ │ └───────────────────────────────────────┘ │ │
│ │                                           │ │
│ │ ┌───────────────────────────────────────┐ │ │
│ │ │ Word Card                              │ │ │
│ │ │ Word, Phonetic, Definition            │ │ │
│ │ │ Restore Button                          │ │ │
│ │ └───────────────────────────────────────┘ │ │
│ └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## 10. Core Function Implementation Examples

### 10.1 handlePrevious Function
```typescript
const handlePrevious = () => {
  if (currentIndex > 0) {
    setCurrentIndex(prev => prev - 1);
    setShowAnswer(false);
  }
};
```

### 10.2 handleIgnoreWord Function
```typescript
const handleIgnoreWord = async () => {
  if (!currentWord) return;
  
  if (status !== 'authenticated' || !session?.user) {
    alert("Please log in before marking words");
    return;
  }
  
  try {
    const res = await fetch('/api/flashcard/ignore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: currentWord.word })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      if (res.status === 401) {
        alert("Please log in before marking words");
      } else {
        throw new Error(data.error || 'Marking failed');
      }
      return;
    }
    
    if (data.success) {
      // Marking successful, switch to next word
      if (currentIndex < words.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setShowAnswer(false);
      } else {
        fetchWords();
      }
    } else {
      throw new Error(data.error || 'Marking failed');
    }
  } catch (e: any) {
    console.error("Failed to ignore word:", e);
    alert(e.message || "Marking failed, please try again later");
  }
};
```

## 11. Summary

This development document is based on the requirements document and details the technical implementation plan for the "Certainly" feature. Through reasonable module design and interface definition, it ensures that the functionality is highly integrated with the existing code architecture. During development, attention should be paid to performance optimization, boundary case handling, state synchronization, and user experience to ensure the stability and smoothness of the functionality.