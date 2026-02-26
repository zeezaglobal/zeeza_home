"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function Globe() {
  const mountRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<{ renderer: THREE.WebGLRenderer; animId: number } | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    const w = window.innerWidth;
    const h = window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f8fa);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
    camera.position.z = 420;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(300, 200, 400);
    scene.add(dir);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // === OCCLUDER SPHERE ===
    const earthGeo = new THREE.SphereGeometry(130, 64, 64);
    const earthMat = new THREE.MeshBasicMaterial({
      color: 0xf8f8fa,
      side: THREE.FrontSide,
    });
    globeGroup.add(new THREE.Mesh(earthGeo, earthMat));

    // === SILHOUETTE BOUNDARY RING ===
    const circleGeo = new THREE.CircleGeometry(130.5, 128);
    const edges = new THREE.EdgesGeometry(circleGeo);
    const boundaryLine = new THREE.LineLoop(
      edges,
      new THREE.LineBasicMaterial({ color: 0x1a1a2e, transparent: true, opacity: 0.15 })
    );
    scene.add(boundaryLine);

    // === COUNTRY OUTLINES ===
    const R_COUNTRY = 130.5;
    const latLngToVec3 = (lat: number, lng: number, r: number): THREE.Vector3 => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);
      return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    };

    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json")
      .then(res => res.json())
      .then((topology: any) => {
        const { arcs: topoArcs, transform } = topology;
        const { scale, translate } = transform;

        const decodedArcs: number[][][] = topoArcs.map((arc: number[][]) => {
          let x = 0, y = 0;
          return arc.map(([dx, dy]: number[]) => {
            x += dx;
            y += dy;
            return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
          });
        });

        const land = topology.objects.land;
        const geoms = land.type === "GeometryCollection" ? land.geometries : [land];

        const countryLineMat = new THREE.LineBasicMaterial({
          color: 0x1a1a2e,
          transparent: true,
          opacity: 0.6,
        });

        const processRing = (arcIndices: number[]) => {
          const points: THREE.Vector3[] = [];
          arcIndices.forEach((idx: number) => {
            let arc: number[][];
            if (idx < 0) {
              arc = [...decodedArcs[~idx]].reverse();
            } else {
              arc = decodedArcs[idx];
            }
            arc.forEach(([lng, lat]: number[]) => {
              points.push(latLngToVec3(lat, lng, R_COUNTRY));
            });
          });
          if (points.length > 1) {
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            globeGroup.add(new THREE.Line(geo, countryLineMat));
          }
        };

        geoms.forEach((geom: any) => {
          if (geom.type === "Polygon") {
            geom.arcs.forEach((ring: number[]) => processRing(ring));
          } else if (geom.type === "MultiPolygon") {
            geom.arcs.forEach((polygon: number[][]) => {
              polygon.forEach((ring: number[]) => processRing(ring));
            });
          }
        });
      })
      .catch(() => {});

    // === LATITUDE RINGS ===
    const latYs = [0, 65, -65, 105, -105];
    const latRadii = [130, 115, 115, 68, 68];
    latYs.forEach((y, i) => {
      const segs = 128;
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= segs; j++) {
        const angle = (j / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(angle) * latRadii[i], y, Math.sin(angle) * latRadii[i]));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: 0x007375,
        transparent: true,
        opacity: i === 0 ? 0.18 : 0.1,
      });
      globeGroup.add(new THREE.Line(geo, mat));
    });

    // === LONGITUDE ARCS ===
    for (let i = 0; i < 12; i++) {
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= 96; j++) {
        const phi = (j / 96) * Math.PI;
        const r = 131;
        const x = r * Math.sin(phi);
        const y = r * Math.cos(phi);
        pts.push(new THREE.Vector3(x, y, 0));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: 0x007375,
        transparent: true,
        opacity: 0.07,
      });
      const line = new THREE.Line(geo, mat);
      line.rotation.y = (i / 12) * Math.PI;
      globeGroup.add(line);
    }

    // === SURFACE DOTS ===
    const dotCount = 1200;
    const dotPositions = new Float32Array(dotCount * 3);
    for (let i = 0; i < dotCount; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r = 132;
      dotPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      dotPositions[i * 3 + 1] = r * Math.cos(phi);
      dotPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute("position", new THREE.BufferAttribute(dotPositions, 3));
    const dotMat = new THREE.PointsMaterial({
      color: 0x007375,
      size: 1.6,
      transparent: true,
      opacity: 0.3,
      sizeAttenuation: true,
    });
    globeGroup.add(new THREE.Points(dotGeo, dotMat));

    // === CITY NODES ===
    const cities: [number, number][] = [
      [43.65, -79.38], [51.51, -0.13], [35.68, 139.69],
      [-33.87, 151.21], [1.35, 103.82], [37.77, -122.42],
      [48.86, 2.35], [19.08, 72.88], [55.76, 37.62], [-22.91, -43.17],
    ];

    const cityVecs: THREE.Vector3[] = [];
    cities.forEach(([lat, lng]) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);
      const r = 133;
      const x = -r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);

      // Bright node
      const nodeGeo = new THREE.SphereGeometry(2.2, 8, 8);
      const nodeMat = new THREE.MeshBasicMaterial({ color: 0x007375, transparent: true, opacity: 0.85 });
      const node = new THREE.Mesh(nodeGeo, nodeMat);
      node.position.set(x, y, z);
      node.userData.isGlow = false;
      globeGroup.add(node);

      // Glow
      const glowGeo = new THREE.SphereGeometry(5, 8, 8);
      const glowMat = new THREE.MeshBasicMaterial({ color: 0x007375, transparent: true, opacity: 0.15 });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set(x, y, z);
      glow.userData.isGlow = true;
      globeGroup.add(glow);

      cityVecs.push(new THREE.Vector3(x, y, z));
    });

    // === CONNECTION ARCS ===
    const conns: [number, number][] = [[0,1],[0,5],[1,6],[2,4],[4,7],[6,8],[3,2],[7,9],[5,6],[1,3]];
    conns.forEach(([a, b]) => {
      const start = cityVecs[a];
      const end = cityVecs[b];
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5).normalize().multiplyScalar(190);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const pts = curve.getPoints(48);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0x007375, transparent: true, opacity: 0.1 });
      globeGroup.add(new THREE.Line(geo, mat));
    });

    // === ATMOSPHERE RING ===
    const atmoGeo = new THREE.RingGeometry(138, 140, 128);
    const atmoMat = new THREE.MeshBasicMaterial({ color: 0x007375, transparent: true, opacity: 0.04, side: THREE.DoubleSide });
    const atmo = new THREE.Mesh(atmoGeo, atmoMat);
    globeGroup.add(atmo);

    // === INPUT: Mouse + Gyroscope ===
    const input = { x: 0, y: 0, tx: 0, ty: 0 };
    let gyroActive = false;
    let gyroBaseAlpha: number | null = null;
    let gyroBaseBeta: number | null = null;

    // Mouse (desktop fallback)
    const onMouseMove = (e: MouseEvent) => {
      if (gyroActive) return; // Gyro takes priority when available
      input.tx = (e.clientX / w) * 2 - 1;
      input.ty = (e.clientY / h) * 2 - 1;
    };
    window.addEventListener("mousemove", onMouseMove);

    // Touch fallback for manual rotation on mobile without gyro permission
    let touchStartX = 0;
    let touchStartY = 0;
    let touchBaseX = 0;
    let touchBaseY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (gyroActive) return;
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchBaseX = input.tx;
      touchBaseY = input.ty;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (gyroActive) return;
      const touch = e.touches[0];
      const dx = (touch.clientX - touchStartX) / w * 2;
      const dy = (touch.clientY - touchStartY) / h * 2;
      input.tx = touchBaseX + dx;
      input.ty = touchBaseY + dy;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    // Gyroscope via DeviceOrientation
    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null) return;

      // Capture baseline on first reading so globe starts centered
      if (gyroBaseAlpha === null) {
        gyroBaseAlpha = e.alpha;
        gyroBaseBeta = e.beta;
      }

      gyroActive = true;

      // Calculate delta from baseline position
      let deltaAlpha = (e.alpha - gyroBaseAlpha!);
      let deltaBeta = (e.beta! - gyroBaseBeta!);

      // Normalize alpha delta to [-180, 180]
      if (deltaAlpha > 180) deltaAlpha -= 360;
      if (deltaAlpha < -180) deltaAlpha += 360;

      // Map gyro angles to input range:
      // Alpha (yaw / left-right tilt): ±45° maps to ±1
      // Beta (pitch / forward-back tilt): ±30° maps to ±1
      const sensitivity = 1.0;
      input.tx = Math.max(-1, Math.min(1, (deltaAlpha / 45) * sensitivity));
      input.ty = Math.max(-1, Math.min(1, (deltaBeta / 30) * sensitivity));
    };

    // Request gyroscope permission (iOS 13+ requires explicit permission)
    const requestGyro = () => {
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof (DeviceOrientationEvent as any).requestPermission === "function"
      ) {
        // iOS 13+
        (DeviceOrientationEvent as any)
          .requestPermission()
          .then((state: string) => {
            if (state === "granted") {
              window.addEventListener("deviceorientation", onDeviceOrientation, true);
            }
          })
          .catch(() => {});
      } else if (typeof DeviceOrientationEvent !== "undefined") {
        // Android & other browsers — just add the listener
        window.addEventListener("deviceorientation", onDeviceOrientation, true);
      }
    };

    // Auto-request on non-iOS, or wait for user gesture on iOS
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof (DeviceOrientationEvent as any).requestPermission === "function"
    ) {
      // iOS: need a user gesture — we attach a one-time tap handler
      const onTapForGyro = () => {
        requestGyro();
        window.removeEventListener("touchend", onTapForGyro);
        window.removeEventListener("click", onTapForGyro);
      };
      window.addEventListener("touchend", onTapForGyro, { once: true });
      window.addEventListener("click", onTapForGyro, { once: true });
    } else {
      requestGyro();
    }

    // Animate
    const clock = new THREE.Clock();
    let animId: number = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Smooth interpolation
      input.x += (input.tx - input.x) * 0.04;
      input.y += (input.ty - input.y) * 0.04;

      globeGroup.rotation.y = t * 0.06 + input.x * 1.5;
      globeGroup.rotation.x = input.y * 0.4;

      atmo.lookAt(camera.position);

      // Pulse glows
      globeGroup.children.forEach((child) => {
        if (child.userData && child.userData.isGlow) {
          (child as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.1 + Math.sin(t * 2.5 + child.position.x) * 0.08;
          const s = 1 + Math.sin(t * 2 + child.position.y) * 0.35;
          child.scale.set(s, s, s);
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nw = window.innerWidth;
      const nh = window.innerHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    threeRef.current = { renderer, animId };

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("deviceorientation", onDeviceOrientation, true);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />;
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  useEffect(() => {
    setTimeout(() => setLoaded(true), 300);
  }, []);

  const copyEmail = () => {
    navigator.clipboard.writeText("support@zeezaglobal.ca");
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2200);
  };

  return (
    <div style={{
      position: "relative",
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      background: "#f8f8fa",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Azeret+Mono:wght@300;400;500&display=swap");

        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #root { overflow: hidden; height: 100%; width: 100%; }
        body { background: #f8f8fa; }
        ::selection { background: rgba(0, 115, 117, 0.2); }

        @keyframes revealMask {
          0% { clip-path: polygon(0 50%, 100% 50%, 100% 50%, 0 50%); }
          100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
        }
        @keyframes fadeUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes subtlePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,115,117,0.12); }
          50% { box-shadow: 0 0 40px 4px rgba(0,115,117,0.06); }
        }
      `}</style>

      <Globe />

      <div style={{
        position: "relative",
        zIndex: 10,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "clamp(24px, 4vw, 48px)",
        pointerEvents: "none",
      }}>
        {/* Top */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          opacity: loaded ? 1 : 0,
          transition: "opacity 1s ease 0.3s",
        }}>
          <div style={{
            fontFamily: "'Azeret Mono', monospace",
            fontSize: "10px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(26,26,46,0.3)",
            lineHeight: 2,
          }}>
            Software Studio<br />
            <span style={{ color: "rgba(0,115,117,0.6)" }}>● Online</span>
          </div>

        </div>

        {/* Center */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "clamp(18px, 3vh, 32px)",
        }}>
          <h1 style={{
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: "clamp(56px, 12vw, 160px)",
            fontWeight: 200,
            fontStyle: "normal",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            textAlign: "center",
            color: "#1a1a2e",
            animation: loaded ? "revealMask 1s cubic-bezier(0.65,0,0.35,1) 0.4s both" : "none",
          }}>
            zeeza<span style={{ fontStyle: "normal", fontWeight: 700, color: "#007375" }}>global</span>
          </h1>

          <p style={{
            fontFamily: "'Azeret Mono', monospace",
            fontSize: "clamp(11px, 1.2vw, 14px)",
            fontWeight: 300,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "rgba(26,26,46,0.3)",
            textAlign: "center",
            animation: loaded ? "fadeUp 0.8s ease 1s both" : "none",
          }}>
            Engineering digital experiences worldwide
            <span style={{ animation: "blink 1.2s step-end infinite", marginLeft: "3px" }}>▌</span>
          </p>

          <div style={{
            animation: loaded ? "fadeUp 0.8s ease 1.3s both" : "none",
            pointerEvents: "auto",
          }}>
            <button
              onClick={copyEmail}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              style={{
                fontFamily: "'Azeret Mono', monospace",
                fontSize: "clamp(12px, 1.1vw, 14px)",
                fontWeight: 400,
                letterSpacing: "0.08em",
                padding: "18px 42px",
                borderRadius: "60px",
                border: hovered ? "1.5px solid rgba(0,115,117,0.4)" : "1.5px solid rgba(26,26,46,0.1)",
                background: hovered ? "rgba(0,115,117,0.04)" : "rgba(255,255,255,0.7)",
                backdropFilter: "blur(12px)",
                color: emailCopied ? "#22c55e" : "#1a1a2e",
                cursor: "pointer",
                transition: "all 0.4s cubic-bezier(0.25,0.46,0.45,0.94)",
                animation: "subtlePulse 4s ease-in-out infinite",
                position: "relative",
                overflow: "visible",
              }}
            >
              {emailCopied ? "✓ Copied to clipboard" : "info@zeezaglobal.ca"}
              {hovered && !emailCopied && (
                <span style={{
                  position: "absolute",
                  top: "-22px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: "9px",
                  fontWeight: 500,
                  color: "rgba(0,115,117,0.55)",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  animation: "fadeUp 0.25s ease both",
                }}>
                  Click to copy
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Bottom */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          opacity: loaded ? 1 : 0,
          transition: "opacity 1s ease 1.6s",
        }}>
          <div style={{
            fontFamily: "'Azeret Mono', monospace",
            fontSize: "10px",
            letterSpacing: "0.14em",
            color: "rgba(26,26,46,0.15)",
            textTransform: "uppercase",
          }}>
            © 2025
          </div>
          <div style={{
            fontFamily: "'Azeret Mono', monospace",
            fontSize: "10px",
            letterSpacing: "0.14em",
            color: "rgba(26,26,46,0.15)",
            textTransform: "uppercase",
          }}>
            Web · Mobile · Cloud · DevOps
          </div>
        </div>
      </div>
    </div>
  );
}