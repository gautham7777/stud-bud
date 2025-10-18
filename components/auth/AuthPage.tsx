
import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { BookOpenIcon, UsersIcon, ChatBubbleIcon, ClipboardListIcon, SparklesIcon, PencilIcon, CheckCircleIcon, ShieldCheckIcon } from '../icons';

const AuthPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const { login, signup } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        if (isLogin) {
            try {
                await login(email, password);
                navigate('/');
            } catch (err: any) {
                setError(err.message || 'Failed to sign in.');
                setIsSubmitting(false);
            }
        } else {
            if (password !== confirmPassword) {
                setError('Passwords do not match.');
                setIsSubmitting(false);
                return;
            }
            try {
                await signup(email, username, password);
                navigate('/');
            } catch (err: any) {
                setError(err.message || "Failed to create account.");
                setIsSubmitting(false);
            }
        }
    };
    
    const toggleForm = () => {
      setIsLogin(!isLogin);
      setError('');
    }

    const inputClasses = "appearance-none block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-gray-700 text-onBackground";
    
    const whyUsPoints = [
      {
        icon: UsersIcon,
        title: "Find Your Perfect Match",
        description: "Our smart algorithm connects you with compatible study partners based on your subjects, learning style, and availability."
      },
      {
        icon: ChatBubbleIcon,
        title: "Collaborate Seamlessly",
        description: "Utilize shared whiteboards, notes, and in-app messaging to work together effectively, no matter where you are."
      },
      {
        icon: ClipboardListIcon,
        title: "Gamified Learning",
        description: "Challenge your group members with AI-generated quizzes and climb the leaderboard to become a subject champion."
      }
    ];

    const featurePoints = [
        { icon: SparklesIcon, name: "AI Study Planner", description: "Generate personalized weekly study plans for any subject to stay on track." },
        { icon: PencilIcon, name: "Collaborative Whiteboard", description: "Visualize complex problems together in real-time with a shared digital canvas." },
        { icon: ClipboardListIcon, name: "Shared Scratchpad", description: "Take notes, draft ideas, and share resources in a persistent group workspace." },
        { icon: CheckCircleIcon, name: "Group Quizzes", description: "Test your knowledge with fun, AI-generated quizzes and compete for the top spot." },
        { icon: UsersIcon, name: "Smart Matching", description: "Post a request for help and get connected with students who can assist you." },
        { icon: ChatBubbleIcon, name: "Instant Messaging", description: "Communicate with your study buddies and groups through our integrated chat." },
    ];


    return (
        <div className="bg-background text-onBackground w-full">
            {/* Auth Screen */}
            <section className="h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">

                <div className="relative z-10">
                    <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                        <div className="flex items-center justify-center gap-3">
                            <BookOpenIcon className="h-10 w-auto text-primary" />
                            <h1 className="text-4xl font-bold text-onBackground">StudyBuddy.com</h1>
                        </div>
                        <h2 className="mt-2 text-center text-lg font-medium text-onSurface">
                            {isLogin ? 'Sign in to your account' : 'Create a new account' }
                        </h2>
                    </div>
                    <div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
                        <div className="bg-surface/80 backdrop-blur-md py-8 px-4 shadow-2xl shadow-primary/10 sm:rounded-lg sm:px-10 border border-gray-700">
                            <form className="space-y-6" onSubmit={handleSubmit}>
                                {!isLogin && (
                                    <div>
                                        <label htmlFor="username" className="block text-sm font-medium text-onSurface">Username</label>
                                        <div className="mt-1"><input id="username" name="username" type="text" required value={username} onChange={e => setUsername(e.target.value)} className={inputClasses} onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)}/></div>
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-onSurface">Email address</label>
                                    <div className="mt-1"><input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputClasses} onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)} /></div>
                                </div>
                                <div>
                                    <label htmlFor="password"  className="block text-sm font-medium text-onSurface">Password</label>
                                    <div className="mt-1"><input id="password" name="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className={inputClasses} onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)}/></div>
                                </div>
                                {!isLogin && (
                                    <div>
                                        <label htmlFor="confirm-password"  className="block text-sm font-medium text-onSurface">Confirm Password</label>
                                        <div className="mt-1"><input id="confirm-password" name="confirm-password" type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClasses} onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)}/></div>
                                    </div>
                                )}
                                {error && <p className="text-sm text-red-400 mt-2 text-center">{error}</p>}
                                <div>
                                    <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-700 to-indigo-500 hover:from-indigo-600 hover:to-indigo-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-all duration-[260ms] transform active:scale-95 hover:shadow-lg hover:shadow-primary/30">
                                        {isSubmitting ? 'Processing...' : (isLogin ? 'Sign in' : 'Create Account')}
                                    </button>
                                </div>
                            </form>
                            {isLogin && (
                                <div className="mt-4 text-sm text-center">
                                    <a href="#" className="font-medium text-primary hover:text-indigo-400">
                                        Forgot your password?
                                    </a>
                                </div>
                            )}
                            <div className="mt-6">
                                <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-600" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-surface text-onSurface">Or</span></div></div>
                                <div className="mt-6"><button onClick={toggleForm} className="w-full inline-flex justify-center py-2 px-4 border border-gray-600 rounded-md shadow-sm bg-surface text-sm font-medium text-onSurface hover:bg-gray-700 transition-colors duration-[195ms]">
                                    {isLogin ? 'Create an account' : 'Sign in instead'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    className={`absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce transition-opacity duration-300 ${isInputFocused ? 'opacity-0 pointer-events-none' : 'opacity-100 cursor-pointer'}`}
                    onClick={() => !isInputFocused && document.getElementById('why-us')?.scrollIntoView({ behavior: 'smooth' })}
                    aria-hidden={isInputFocused}
                >
                    <svg className="w-6 h-6 text-onSurface" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                </div>
            </section>

            <section id="why-us" className="py-24 px-4 sm:px-6 lg:px-8">
                <div className="container mx-auto text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-onBackground sm:text-4xl">Why Choose StudyBuddy?</h2>
                    <p className="mt-4 text-lg leading-8 text-onSurface">Connect, collaborate, and conquer your courses like never before.</p>
                    <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-12">
                        {whyUsPoints.map((point) => (
                            <div key={point.title} className="flex flex-col items-center">
                                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/20 text-primary mb-4">
                                    <point.icon className="h-8 w-8" />
                                </div>
                                <h3 className="text-xl font-semibold text-onBackground">{point.title}</h3>
                                <p className="mt-2 text-onSurface">{point.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            
            <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-surface/50">
                 <div className="container mx-auto text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-onBackground sm:text-4xl">Powerful Features to Boost Your Learning</h2>
                    <p className="mt-4 text-lg leading-8 text-onSurface">All the tools you need for academic success, in one place.</p>
                    <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        {featurePoints.map(feature => (
                            <div key={feature.name} className="bg-surface p-6 rounded-lg text-left transform hover:-translate-y-2 transition-transform duration-300 border border-gray-700">
                                <feature.icon className="h-8 w-8 text-secondary mb-3"/>
                                <h3 className="text-lg font-semibold text-onBackground">{feature.name}</h3>
                                <p className="mt-1 text-onSurface text-sm">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                 </div>
            </section>

            <section id="security" className="py-24 px-4 sm:px-6 lg:px-8">
                 <div className="container mx-auto text-center">
                    <ShieldCheckIcon className="h-16 w-16 text-green-400 mx-auto mb-4"/>
                    <h2 className="text-3xl font-bold tracking-tight text-onBackground sm:text-4xl">Your Safety is Our Priority</h2>
                    <p className="mt-4 text-lg leading-8 text-onSurface max-w-3xl mx-auto">We are committed to providing a secure and positive environment for focused learning.</p>
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 text-left max-w-4xl mx-auto">
                        <div className="bg-surface p-6 rounded-lg border border-gray-700">
                            <h3 className="text-xl font-semibold text-onBackground">Report & Block System</h3>
                            <p className="mt-2 text-onSurface">Easily report or block any user displaying inappropriate behavior. Our moderation team will review all reports promptly to take necessary action and ensure community guidelines are upheld.</p>
                        </div>
                        <div className="bg-surface p-6 rounded-lg border border-gray-700">
                            <h3 className="text-xl font-semibold text-onBackground">AI-Powered Moderation</h3>
                            <p className="mt-2 text-onSurface">Our system uses advanced AI to proactively flag and review potentially harmful or off-topic content in public spaces, helping to maintain a productive and respectful atmosphere.</p>
                        </div>
                    </div>
                 </div>
            </section>
            
            <section id="creators" className="py-24 px-4 sm:px-6 lg:px-8 bg-surface/50">
                 <div className="container mx-auto text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-onBackground sm:text-4xl">Meet the Team</h2>
                    <p className="mt-4 text-lg leading-8 text-onSurface">The passionate creators behind StudyBuddy.</p>
                    <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8">
                        {['Ishan', 'Gautham', 'Jude', 'Wilton'].map(name => (
                            <div key={name} className="flex flex-col items-center">
                                <UsersIcon className="h-20 w-20 text-onSurface"/>
                                <h3 className="mt-4 text-xl font-semibold text-onBackground">{name}</h3>
                            </div>
                        ))}
                    </div>
                 </div>
            </section>

            <footer className="py-8 px-4 text-center text-onSurface text-sm border-t border-gray-700">
                <p>&copy; {new Date().getFullYear()} StudyBuddy.com. All rights reserved.</p>
                <p className="mt-2">For support, contact us at: <a href="mailto:studybuddypartners@gmail.com" className="font-semibold text-primary hover:underline">studybuddypartners@gmail.com</a></p>
            </footer>
        </div>
    );
};

export default AuthPage;