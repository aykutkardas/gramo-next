# Gramo - Advanced Text Enhancement Platform

Gramo is a modern, AI-powered text enhancement platform that helps users improve their writing through advanced grammar checking, style analysis, and intelligent suggestions. The platform combines the power of large language models with a beautiful, user-friendly interface to provide comprehensive writing assistance.

## Features

- **Intelligent Text Analysis**: Get comprehensive feedback on grammar, style, and structure
- **Multiple Output Styles**:
  - Grammar Fix: Correct grammatical errors while preserving meaning
  - Friendly Tone: Transform text into a more approachable style
  - Professional Polish: Enhance formality and business appropriateness
  - Concise Writing: Streamline text while maintaining key information
- **Focus Areas**:
  - Grammar: Identify and fix grammatical issues
  - Style: Enhance writing style and tone
  - Structure: Improve text organization and flow
- **Real-time Updates**: See changes and improvements instantly
- **Goal Achievement Tracking**: Monitor how well the text meets intended objectives
- **Modern UI**: Clean, responsive interface with dark mode support and intuitive controls

## Tech Stack

### Frontend

- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- Shadcn/ui Components
- Custom React Hooks for state management
- Axios for API communication

### Backend

- FastAPI
- Python 3.11+
- LangChain for LLM orchestration
- Groq for LLM integration
- Pydantic for data validation
- Custom text analysis utilities

## Getting Started

### Prerequisites

- Node.js 18+ for frontend
- Python 3.11+ for backend
- Groq API key

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/gramo.git
cd gramo
```

2. Set up the backend:

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Edit .env with your Groq API key
```

3. Set up the frontend:

```bash
cd frontend
npm install
```

### Running the Application

1. Start the backend server:

```bash
cd backend
uvicorn app.main:app --reload
```

2. Start the frontend development server:

```bash
cd frontend
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

## Project Structure

```
gramo/
├── backend/
│   ├── app/
│   │   ├── config/
│   │   │   └── settings.py     # Application configuration
│   │   ├── models/
│   │   │   └── text_analysis.py # Data models
│   │   ├── routers/
│   │   │   └── text_analysis.py # API endpoints
│   │   ├── services/
│   │   │   └── writing_agent.py # LLM integration
│   │   ├── utils/
│   │   │   ├── text_analysis.py # Analysis utilities
│   │   │   └── rate_limiter.py  # API rate limiting
│   │   ├── main.py             # FastAPI application
│   │   └── test_agents.py      # Test cases
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── app/
    │   └── page.tsx            # Main application page
    ├── components/
    │   ├── text-analysis/
    │   │   ├── text-analysis-overview.tsx
    │   │   ├── improved-text.tsx
    │   │   ├── goal-achievement.tsx
    │   │   └── grammar-issues.tsx
    │   └── ui/                 # Reusable UI components
    ├── hooks/
    │   └── use-text-analysis.ts # Custom text analysis hook
    └── types/                  # TypeScript type definitions
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Groq](https://groq.com/) for LLM API
- [LangChain](https://python.langchain.com/) for LLM framework
- [Shadcn/ui](https://ui.shadcn.com/) for UI components
- [Next.js](https://nextjs.org/) for the frontend framework
