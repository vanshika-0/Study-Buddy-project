Study Buddy
Study Buddy is an AI study-management platform that helps students
organize their study routine, track progress, and get learning support
in one place.

Features
- AI Study Planner: Create monthly study schedules and manage
  tasks.
- Study-Time Tracking: Record study sessions and review time spent
  studying.
- Progress Dashboard: Track study activity, completed tasks, and
  progress.
- Tests & Performance: Monitor test results and identify topics
  for revision.
- Revision & Notes: Organize revision tasks and important study
  notes.
- Focus Sessions: Build a consistent study routine with focused
  sessions.
- AI Study Chat: Ask education-related questions and get learning
  support.
- User Accounts: Sign in to access personalized study information.


Tech Stack
- Frontend: Next.js
- Backend: Python, FastAPI
- Database: MongoDB / MongoDB Atlas
- AI Integration: Groq API / LLM
- Email Delivery: Resend or SMTP, depending on configuration

  
Architecture
Student → Next.js Frontend → FastAPI Backend
                                ├── MongoDB
                                └── Groq API / LLM
                                
The frontend provides the user interface, while FastAPI handles
application logic, database operations, and AI requests.

Project Structure
study-buddy/
├── frontend/    # Next.js application
└── backend/     # FastAPI application
Folder names may differ based on your repository.


Prerequisites
- Node.js and npm
- Python 3
- MongoDB database
- Groq API key
- Email credentials, if email features are enabled

  
Getting Started
1. Clone the Repository
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <YOUR_REPOSITORY_FOLDER>

2. Set Up the Backend
Go to the backend folder, create and activate a virtual environment,
then install dependencies from your project's requirements file.

i) cd backend
ii) python -m venv .venv
iii) .venv\Scripts\activate
iv) pip install -r requirements.txt
v) Create a .env file with the configuration required by your code, such
   as the MongoDB connection string, Groq API key, and timezone
   (Asia/Kolkata). Start FastAPI using your project's actual application
   module, for example:
vi) uvicorn main:app --reload

3. Set Up the Frontend
In a separate terminal:
i) cd frontend
ii) npm install
iii) npm run dev
iv) Set the backend API URL in the frontend environment file using the
    variable name expected by your code. The local Next.js app is commonly
    available at http://localhost:3000.


Deployment
- Deploy the frontend on Vercel.
- Deploy the backend on a Python-compatible service such as
  Render.
- Configure production environment variables, backend CORS, and the
  correct frontend API URL.
  
Security
- Keep API keys and database credentials private.
- Never commit .env files to GitHub.
- Keep private AI and database credentials on the backend.

Future Improvements
Possible enhancements include richer learning analytics, smarter
revision recommendations, and additional progress visualizations.
License
Add a license if you plan to distribute the project publicly. No license
is specified here.
