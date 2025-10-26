import React from 'react';

const AnimatedShapes: React.FC = () => (
    <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        {/* Existing shapes with new animations */}
        <div className="bg-shape bg-primary/10 animate-move1" style={{ width: '25vw', height: '25vw', top: '5%', left: '15%', animationDelay: '0s' }}></div>
        <div className="bg-shape bg-secondary/10 animate-move2" style={{ width: '15vw', height: '15vw', top: '60%', left: '70%', animationDelay: '3s' }}></div>
        <div className="bg-shape bg-amber-500/5 animate-move3" style={{ width: '30vw', height: '30vw', top: '40%', left: '5%', animationDelay: '1s' }}></div>

        {/* New shapes for a more dynamic background */}
        <div className="bg-shape bg-rose-500/5 animate-move4" style={{ width: '20vw', height: '20vw', top: '10%', right: '10%', animationDelay: '5s' }}></div>
        <div className="bg-shape bg-sky-500/10 animate-move1" style={{ width: '18vw', height: '18vw', bottom: '5%', left: '30%', animationDelay: '8s' }}></div>
        <div className="bg-shape bg-fuchsia-500/5 animate-move2" style={{ width: '22vw', height: '22vw', bottom: '15%', right: '25%', animationDelay: '2s' }}></div>
    </div>
);

export default AnimatedShapes;
