import React from 'react';

const AnimatedShapes: React.FC = () => (
    <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="bg-shape bg-primary/10" style={{ width: '25vw', height: '25vw', top: '5%', left: '15%', animationDelay: '0s', animationDuration: '25s' }}></div>
        <div className="bg-shape bg-secondary/10" style={{ width: '15vw', height: '15vw', top: '60%', left: '70%', animationDelay: '3s', animationDuration: '20s' }}></div>
        <div className="bg-shape bg-amber-500/5" style={{ width: '30vw', height: '30vw', top: '40%', left: '5%', animationDelay: '6s', animationDuration: '30s' }}></div>
    </div>
);

export default AnimatedShapes;
