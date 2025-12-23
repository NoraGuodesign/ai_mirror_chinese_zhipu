
import React, { useEffect, useRef } from 'react';
import { GestureType } from '../types';

interface Props {
  gesture: GestureType;
}

const GestureEffects: React.FC<Props> = ({ gesture }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<any[]>([]);
  const requestRef = useRef<number>(null);

  const colors = {
    cyan: '#A9FFFA',
    white: '#ffffff',
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const createParticle = (x: number, y: number, type: GestureType) => {
      // Victory/Peace sign triggers fireworks, Thumbs up and Heart are smaller bursts
      const count = type === 'victory' ? 60 : 30;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = type === 'victory' ? Math.random() * 8 + 2 : Math.random() * 5 + 1;
        particles.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 4 + 1,
          color: Math.random() > 0.5 ? colors.cyan : colors.white,
          alpha: 1,
          life: 1,
          decay: Math.random() * 0.02 + 0.015,
          type
        });
      }
    };

    if (gesture) {
      const x = canvas.width / 2;
      const y = canvas.height / 2;
      createParticle(x, y, gesture);
    }

    const drawHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x, y - size / 2, x - size, y - size / 2, x - size, y);
      ctx.bezierCurveTo(x - size, y + size / 2, x, y + size, x, y + size);
      ctx.bezierCurveTo(x, y + size, x + size, y + size / 2, x + size, y);
      ctx.bezierCurveTo(x + size, y - size / 2, x, y - size / 2, x, y);
      ctx.fill();
    };

    const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
      const spikes = 5;
      const innerRadius = r * 0.4;
      const outerRadius = r;
      let rot = Math.PI / 2 * 3;
      let cx = x;
      let cy = y;
      let step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        cx = x + Math.cos(rot) * outerRadius;
        cy = y + Math.sin(rot) * outerRadius;
        ctx.lineTo(cx, cy);
        rot += step;

        cx = x + Math.cos(rot) * innerRadius;
        cy = y + Math.sin(rot) * innerRadius;
        ctx.lineTo(cx, cy);
        rot += step;
      }
      ctx.lineTo(x, y - outerRadius);
      ctx.closePath();
      ctx.fill();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.x += p.vx;
        p.y += p.vy;
        
        // Gravity effect for fireworks
        if (p.type === 'victory') p.vy += 0.08;
        
        p.life -= p.decay;
        
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;

        if (p.type === 'heart') {
          drawHeart(ctx, p.x, p.y, p.size * 4);
        } else if (p.type === 'thumbs_up') {
          // Drawing a star for the "thumbs up" gesture as requested
          drawStar(ctx, p.x, p.y, p.size * 3.5);
        } else {
          // Standard firework sparkle (rect for sharp aesthetic)
          const s = p.size;
          ctx.fillRect(p.x - s/2, p.y - s/2, s, s);
        }

        if (p.life <= 0) {
          particles.current.splice(i, 1);
        }
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [gesture]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-[100] rounded-[30px]" 
      style={{ mixBlendMode: 'screen' }}
    />
  );
};

export default GestureEffects;
