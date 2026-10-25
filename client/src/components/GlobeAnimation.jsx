import React, { useRef, useEffect, useCallback } from 'react';

// ─── Simplified world continent outlines (lon, lat pairs) ────────
// Each sub-array is a continent outline stroke
const CONTINENT_PATHS = [
  // North America
  [[-130,50],[-125,55],[-120,60],[-115,65],[-110,68],[-100,70],[-90,68],[-80,65],[-75,60],[-70,55],[-65,50],[-68,45],[-75,40],[-80,35],[-82,30],[-85,25],[-90,20],[-95,18],[-100,20],[-105,22],[-110,28],[-115,30],[-120,35],[-125,42],[-130,50]],
  // South America
  [[-80,10],[-75,5],[-70,0],[-65,-5],[-60,-10],[-55,-15],[-50,-20],[-48,-25],[-50,-30],[-55,-35],[-60,-40],[-65,-45],[-70,-50],[-75,-45],[-72,-40],[-70,-35],[-72,-30],[-75,-25],[-78,-20],[-80,-15],[-82,-10],[-80,-5],[-78,0],[-80,5],[-80,10]],
  // Europe
  [[-10,38],[-5,42],[0,44],[5,46],[10,48],[15,50],[20,52],[25,55],[30,58],[35,60],[40,62],[35,65],[30,68],[25,70],[20,68],[15,65],[10,60],[5,58],[0,55],[-5,50],[-8,45],[-10,38]],
  // Africa
  [[-15,30],[-10,32],[-5,35],[0,35],[5,37],[10,35],[15,33],[20,32],[25,30],[30,28],[33,25],[35,20],[38,15],[40,10],[42,5],[45,0],[42,-5],[40,-10],[38,-15],[35,-20],[32,-25],[30,-30],[28,-33],[25,-35],[22,-33],[18,-30],[15,-25],[12,-20],[10,-15],[8,-10],[5,-5],[2,0],[0,5],[-5,10],[-10,15],[-15,20],[-18,25],[-15,30]],
  // Asia
  [[30,30],[35,35],[40,38],[45,40],[50,42],[55,45],[60,48],[65,50],[70,52],[75,55],[80,58],[85,55],[90,50],[95,48],[100,45],[105,40],[110,38],[115,35],[120,32],[125,30],[130,35],[135,38],[140,40],[145,42],[140,45],[135,50],[130,55],[125,60],[120,65],[110,68],[100,70],[90,68],[80,65],[70,60],[60,55],[50,50],[45,45],[40,40],[35,35],[30,30]],
  // Australia
  [[115,-15],[120,-12],[125,-13],[130,-12],[135,-13],[140,-15],[145,-18],[148,-22],[150,-25],[148,-28],[145,-32],[142,-35],[138,-35],[135,-33],[130,-32],[125,-30],[120,-28],[118,-25],[115,-22],[113,-20],[115,-15]],
  // India (more detail)
  [[68,30],[70,28],[72,25],[73,22],[75,20],[76,18],[78,15],[79,12],[80,10],[80,8],[78,8],[76,10],[74,12],[72,15],[70,18],[69,20],[68,22],[67,25],[68,28],[68,30]],
];

// Major world cities for the booking theme: [lon, lat, name, importance(0-1)]
const CITIES = [
  [72.8777, 19.0760, 'Mumbai', 1],
  [77.1025, 28.7041, 'Delhi', 0.9],
  [73.8567, 15.2993, 'Goa', 0.8],
  [77.5946, 12.9716, 'Bangalore', 0.7],
  [75.7873, 26.9124, 'Jaipur', 0.7],
  [2.3522, 48.8566, 'Paris', 0.9],
  [-73.9857, 40.7484, 'New York', 1],
  [139.6917, 35.6895, 'Tokyo', 0.9],
  [-0.1278, 51.5074, 'London', 1],
  [103.8198, 1.3521, 'Singapore', 0.8],
  [55.2708, 25.2048, 'Dubai', 0.9],
  [151.2093, -33.8688, 'Sydney', 0.8],
  [-43.1729, -22.9068, 'Rio', 0.7],
  [37.6173, 55.7558, 'Moscow', 0.6],
  [-118.2437, 34.0522, 'LA', 0.7],
  [114.1694, 22.3193, 'Hong Kong', 0.8],
  [100.5018, 13.7563, 'Bangkok', 0.8],
  [28.9784, 41.0082, 'Istanbul', 0.7],
  [12.4964, 41.9028, 'Rome', 0.6],
  [-3.7038, 40.4168, 'Madrid', 0.6],
  [174.7633, -36.8485, 'Auckland', 0.5],
  [18.4241, -33.9249, 'Cape Town', 0.6],
  [121.4737, 31.2304, 'Shanghai', 0.8],
  [126.9780, 37.5665, 'Seoul', 0.7],
  [13.4050, 52.5200, 'Berlin', 0.6],
];

// Flight routes (city index pairs)
const FLIGHT_ROUTES = [
  [0, 5], [0, 10], [1, 7], [3, 15], [6, 8],
  [6, 5], [8, 10], [7, 11], [9, 16], [0, 6],
  [5, 13], [10, 15], [4, 10], [2, 8], [11, 21],
];

const GlobeAnimation = () => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const stateRef = useRef({
    phase: 'globe-enter', // 'globe-enter' -> 'globe-spin' -> 'morph' -> 'map'
    time: 0,
    globeX: -300,       // start off-screen left
    globeRotation: 0,
    morphProgress: 0,
    mapOpacity: 0,
    cityPulses: CITIES.map(() => Math.random() * Math.PI * 2),
    flightProgress: FLIGHT_ROUTES.map(() => ({ progress: -1, delay: 0 })),
    particles: Array.from({ length: 40 }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0003,
      vy: (Math.random() - 0.5) * 0.0003,
      size: 1 + Math.random() * 2,
      opacity: 0.1 + Math.random() * 0.3,
    })),
  });

  // Convert lon/lat to 2D map coordinates
  const lonLatToMap = useCallback((lon, lat, w, h, offsetX = 0, offsetY = 0) => {
    const x = ((lon + 180) / 360) * w * 0.85 + w * 0.075 + offsetX;
    const y = ((90 - lat) / 180) * h * 0.75 + h * 0.12 + offsetY;
    return [x, y];
  }, []);

  // Convert lon/lat to 3D globe coordinates
  const lonLatToGlobe = useCallback((lon, lat, cx, cy, radius, rotation) => {
    const lonRad = ((lon + rotation) * Math.PI) / 180;
    const latRad = (lat * Math.PI) / 180;
    const x = cx + radius * Math.cos(latRad) * Math.sin(lonRad);
    const y = cy - radius * Math.sin(latRad);
    const z = Math.cos(latRad) * Math.cos(lonRad);
    return [x, y, z]; // z > 0 means front-facing
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let lastTime = performance.now();
    // Size cached here instead of measuring the layout every frame
    let size = { w: 0, h: 0 };
    let onScreen = true;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      // Skip the intro and show the finished map as a still image
      Object.assign(stateRef.current, { phase: 'map', morphProgress: 1, mapOpacity: 1, time: 0 });
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement.getBoundingClientRect();
      size = { w: rect.width, h: rect.height };
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const drawGlobe = (cx, cy, radius, rotation, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha;

      // Globe outline glow
      const glow = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.3);
      glow.addColorStop(0, 'rgba(99, 102, 241, 0.12)');
      glow.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Globe circle
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Latitude lines
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
        ctx.lineWidth = 0.8;
        for (let lon = -180; lon <= 180; lon += 5) {
          const [x, y, z] = lonLatToGlobe(lon, lat, cx, cy, radius, rotation);
          if (z > 0) {
            if (lon === -180 || z <= 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // Longitude lines
      for (let lon = -180; lon < 180; lon += 30) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
        ctx.lineWidth = 0.8;
        let started = false;
        for (let lat = -90; lat <= 90; lat += 5) {
          const [x, y, z] = lonLatToGlobe(lon, lat, cx, cy, radius, rotation);
          if (z > 0) {
            if (!started) { ctx.moveTo(x, y); started = true; }
            else ctx.lineTo(x, y);
          } else {
            started = false;
          }
        }
        ctx.stroke();
      }

      // Continent outlines on globe
      CONTINENT_PATHS.forEach((path) => {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(99, 210, 255, 0.5)';
        ctx.lineWidth = 1.2;
        let moved = false;
        path.forEach(([lon, lat]) => {
          const [x, y, z] = lonLatToGlobe(lon, lat, cx, cy, radius, rotation);
          if (z > 0) {
            if (!moved) { ctx.moveTo(x, y); moved = true; }
            else ctx.lineTo(x, y);
          } else {
            moved = false;
          }
        });
        ctx.stroke();
      });

      // Cities on globe
      CITIES.forEach(([lon, lat, , importance], i) => {
        const [x, y, z] = lonLatToGlobe(lon, lat, cx, cy, radius, rotation);
        if (z > 0.1) {
          const pulse = Math.sin(stateRef.current.cityPulses[i]) * 0.4 + 0.6;
          const dotSize = (2 + importance * 2) * pulse;
          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251, 191, 36, ${0.6 * z * pulse})`;
          ctx.fill();
          // glow
          ctx.beginPath();
          ctx.arc(x, y, dotSize * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251, 191, 36, ${0.15 * z * pulse})`;
          ctx.fill();
        }
      });

      ctx.restore();
    };

    const drawMap = (w, h, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha;

      // Continent outlines on map
      CONTINENT_PATHS.forEach((path) => {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(99, 210, 255, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.fillStyle = 'rgba(99, 210, 255, 0.04)';
        path.forEach(([lon, lat], j) => {
          const [x, y] = lonLatToMap(lon, lat, w, h);
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });

      // Subtle grid
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.06)';
      ctx.lineWidth = 0.5;
      for (let lon = -180; lon <= 180; lon += 30) {
        const [x1, y1] = lonLatToMap(lon, -90, w, h);
        const [x2, y2] = lonLatToMap(lon, 90, w, h);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        const [x1, y1] = lonLatToMap(-180, lat, w, h);
        const [x2, y2] = lonLatToMap(180, lat, w, h);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Cities (labels only on wider screens; on phones they ran into the hero text)
      const showLabels = w >= 640;
      CITIES.forEach(([lon, lat, name, importance], i) => {
        const [x, y] = lonLatToMap(lon, lat, w, h);
        const pulse = Math.sin(stateRef.current.cityPulses[i]) * 0.4 + 0.6;
        const dotSize = (2.5 + importance * 2.5) * pulse;

        // Outer glow
        const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, dotSize * 4);
        glowGrad.addColorStop(0, `rgba(251, 191, 36, ${0.25 * pulse})`);
        glowGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y, dotSize * 4, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251, 191, 36, ${0.7 + 0.3 * pulse})`;
        ctx.fill();

        // City name for important cities
        if (showLabels && importance >= 0.8) {
          ctx.font = '10px Inter, sans-serif';
          ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + 0.2 * pulse})`;
          ctx.textAlign = 'center';
          ctx.fillText(name, x, y - dotSize * 2 - 4);
        }
      });

      // Flight arcs
      FLIGHT_ROUTES.forEach((route, ri) => {
        const fp = stateRef.current.flightProgress[ri];
        if (fp.progress < 0 || fp.progress > 1) return;

        const [lon1, lat1] = [CITIES[route[0]][0], CITIES[route[0]][1]];
        const [lon2, lat2] = [CITIES[route[1]][0], CITIES[route[1]][1]];
        const [x1, y1] = lonLatToMap(lon1, lat1, w, h);
        const [x2, y2] = lonLatToMap(lon2, lat2, w, h);

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.25;

        // Draw the arc trail
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.lineWidth = 1.2;

        const steps = 50;
        const endStep = Math.floor(fp.progress * steps);
        const startStep = Math.max(0, endStep - 20);

        for (let s = startStep; s <= endStep; s++) {
          const t = s / steps;
          const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * midX + t * t * x2;
          const py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * midY + t * t * y2;
          if (s === startStep) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Moving dot
        const t = fp.progress;
        const dotX = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * midX + t * t * x2;
        const dotY = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * midY + t * t * y2;

        ctx.beginPath();
        ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(165, 180, 252, 0.9)';
        ctx.fill();

        // Dot glow
        const dg = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, 8);
        dg.addColorStop(0, 'rgba(165, 180, 252, 0.4)');
        dg.addColorStop(1, 'rgba(165, 180, 252, 0)');
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 8, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
    };

    const drawParticles = (w, h) => {
      stateRef.current.particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139, 92, 246, ${p.opacity})`;
        ctx.fill();
      });
    };

    const animate = (timestamp) => {
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap delta
      lastTime = timestamp;

      const { w, h } = size;
      const st = stateRef.current;

      st.time += dt;

      // Phase transitions
      const globeEnterDuration = 2.0;
      const globeSpinDuration = 1.5;
      const morphDuration = 2.0;

      if (st.phase === 'globe-enter') {
        const progress = Math.min(st.time / globeEnterDuration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        st.globeX = -300 + (w * 0.5 + 300) * eased;
        st.globeRotation += dt * 40;
        if (progress >= 1) {
          st.phase = 'globe-spin';
          st.time = 0;
        }
      } else if (st.phase === 'globe-spin') {
        st.globeRotation += dt * 50;
        if (st.time >= globeSpinDuration) {
          st.phase = 'morph';
          st.time = 0;
        }
      } else if (st.phase === 'morph') {
        const progress = Math.min(st.time / morphDuration, 1);
        // Smooth ease in-out
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        st.morphProgress = eased;
        st.globeRotation += dt * 30 * (1 - eased);
        st.mapOpacity = eased;
        if (progress >= 1) {
          st.phase = 'map';
          st.time = 0;
          // Initialize flight delays
          st.flightProgress = FLIGHT_ROUTES.map((_, i) => ({
            progress: -1,
            delay: 0.5 + i * 0.6 + Math.random() * 0.5,
          }));
        }
      } else {
        // Map phase — animate flights
        st.flightProgress.forEach((fp) => {
          if (fp.delay > 0) {
            fp.delay -= dt;
          } else if (fp.progress < 0) {
            fp.progress = 0;
          } else if (fp.progress <= 1) {
            fp.progress += dt * 0.35;
            if (fp.progress > 1.3) {
              fp.progress = -1;
              fp.delay = 3 + Math.random() * 5;
            }
          }
        });
      }

      // Update city pulses
      st.cityPulses = st.cityPulses.map((p) => p + dt * (1.5 + Math.random() * 0.5));

      // Update particles
      st.particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;
      });

      // ─── Draw ─────────────────────────────────
      ctx.clearRect(0, 0, w, h);

      // Background vignette
      const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.8);
      vignette.addColorStop(0, 'rgba(15, 12, 41, 0)');
      vignette.addColorStop(1, 'rgba(8, 6, 22, 0.6)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      const radius = Math.min(w, h) * 0.3;
      const globeAlpha = 1 - st.morphProgress;
      const mapAlpha = st.mapOpacity;

      // Draw globe
      if (globeAlpha > 0.01) {
        drawGlobe(st.globeX, h * 0.48, radius, st.globeRotation, globeAlpha);
      }

      // Draw map
      if (mapAlpha > 0.01) {
        drawMap(w, h, mapAlpha);
      }

      // Particles always
      drawParticles(w, h);

      animRef.current = null;
      if (!reduceMotion && onScreen && !document.hidden) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    const start = () => {
      if (animRef.current || !onScreen || document.hidden) return;
      lastTime = performance.now();
      animRef.current = requestAnimationFrame(animate);
    };

    // Stop drawing while the hero is scrolled away or the tab is in the background
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      start();
    });
    observer.observe(canvas);
    document.addEventListener('visibilitychange', start);
    // Resizing clears the canvas; repaints the still frame when motion is reduced
    window.addEventListener('resize', start);

    start();

    return () => {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
      observer.disconnect();
      document.removeEventListener('visibilitychange', start);
      window.removeEventListener('resize', start);
      window.removeEventListener('resize', resize);
    };
  }, [lonLatToMap, lonLatToGlobe]);

  return (
    <canvas
      ref={canvasRef}
      className="globe-canvas"
      aria-hidden="true"
    />
  );
};

export default GlobeAnimation;
