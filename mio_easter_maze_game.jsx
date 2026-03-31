import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { Cat, Egg, Trophy, RotateCcw, Play, ChevronRight, Clock3, Heart, Volume2, VolumeX } from "lucide-react";

const MOBILE_BREAKPOINT = 768;
const DESKTOP_CELL = 40;
const MOBILE_CELL = 24;
const SAFE_TOP = "max(env(safe-area-inset-top), 0px)";
const SAFE_BOTTOM = "max(env(safe-area-inset-bottom), 0px)";
// Replace this with your image path if needed (e.g., /mio.png or hosted URL)
const MIO_IMAGE = "https://res.cloudinary.com/dfzfpfdj5/image/upload/v1774937583/MIO_Face_jdbiyb.png";

const LEVELS = [
  {
    name: "Sunny Meadow",
    timeLimit: 75,
    message: "The eggs are hiding in the spring grass. Let's pounce, Mio!",
    grid: [
      "############",
      "#S...E....X#",
      "#.##.##.##.#",
      "#..B....E..#",
      "#.####.##..#",
      "#..E..#....#",
      "#.##..#.##.#",
      "#....T...E.#",
      "############",
    ],
  },
  {
    name: "Blossom Burrow",
    timeLimit: 90,
    message: "Bunnies are hopping faster now. Stay sharp, Mio!",
    grid: [
      "##############",
      "#S...#..E...X#",
      "#.##.#.####..#",
      "#..E.#....#..#",
      "##.#.##B.#.###",
      "#..#....#....#",
      "#.####.##.##.#",
      "#E.....T..E..#",
      "#.##.######..#",
      "#....B.......#",
      "##############",
    ],
  },
  {
    name: "Rainbow Garden",
    timeLimit: 105,
    message: "Final maze. The Easter basket is almost full!",
    grid: [
      "################",
      "#S..E...#...E..#",
      "#.####..#.###.X#",
      "#...#...#...#..#",
      "#B#.#.#####.#.##",
      "#.#...E..#..#..#",
      "#.#####..#.##..#",
      "#...#....#..E..#",
      "###.#.##.###...#",
      "#...#..T....B..#",
      "#E..####.##....#",
      "################",
    ],
  },
];

function parseLevel(level) {
  const grid = level.grid.map((row) => row.split(""));
  let start = { x: 0, y: 0 };
  let exit = { x: 0, y: 0 };
  const eggs = [];
  const bunnies = [];
  const traps = [];

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const cell = grid[y][x];
      if (cell === "S") start = { x, y };
      if (cell === "X") exit = { x, y };
      if (cell === "E") eggs.push({ x, y, collected: false });
      if (cell === "B") bunnies.push({ x, y, dir: 1, axis: y % 2 === 0 ? "x" : "y" });
      if (cell === "T") traps.push({ x, y });
    }
  }

  return {
    width: grid[0].length,
    height: grid.length,
    walls: grid,
    start,
    exit,
    eggs,
    bunnies,
    traps,
  };
}

function isWalkable(levelData, x, y) {
  const row = levelData.walls[y];
  if (!row) return false;
  const cell = row[x];
  return cell && cell !== "#";
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function useTone(enabled) {
  const ctxRef = useRef(null);

  const beep = (freq = 440, duration = 0.08, type = "sine") => {
    if (!enabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!ctxRef.current) ctxRef.current = new AudioCtx();
      const ctx = ctxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = 0.03;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.stop(ctx.currentTime + duration);
    } catch {
      // fail silently
    }
  };

  return { beep };
}

function MioSprite({ direction = "right", className = "" }) {
  return (
    <div
      className={`relative ${className}`}
      style={{ transform: direction === "left" ? "scaleX(-1)" : "scaleX(1)" }}
    >
      <div className="absolute inset-0 rounded-xl bg-sky-300/20 blur-[6px] scale-90" />
      <div className="relative h-8 w-8 overflow-hidden rounded-xl border border-white/70 bg-white/80 shadow-[0_6px_18px_rgba(70,90,140,0.28)]">
        <img src={MIO_IMAGE} alt="Mio" className="h-full w-full object-cover object-center scale-[1.18]" draggable={false} />
      </div>
    </div>
  );
}

export default function MioEasterMazeGame() {
  const [screen, setScreen] = useState("intro");
  const [levelIndex, setLevelIndex] = useState(0);
  const [player, setPlayer] = useState({ x: 0, y: 0 });
  const [playerDirection, setPlayerDirection] = useState("right");
  const [eggs, setEggs] = useState([]);
  const [bunnies, setBunnies] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [message, setMessage] = useState("Help Mio find all the Easter eggs!");
  const [soundOn, setSoundOn] = useState(true);  const [bestScore, setBestScore] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const { beep } = useTone(soundOn);

  useEffect(() => {
    const saved = Number(localStorage.getItem("mio-easter-best") || 0);
    setBestScore(saved);

    const updateViewport = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const level = LEVELS[levelIndex];
  const levelData = useMemo(() => parseLevel(level), [level]);

  const collectedCount = eggs.filter((e) => e.collected).length;
  const cellSize = isMobile ? MOBILE_CELL : DESKTOP_CELL;
  const totalEggs = eggs.length;
  const progress = totalEggs ? (collectedCount / totalEggs) * 100 : 0;

  const initLevel = (idx = levelIndex, keepScore = true, keepLives = true) => {
    const parsed = parseLevel(LEVELS[idx]);
    setPlayer(parsed.start);
    setPlayerDirection("right");
    setEggs(parsed.eggs);
    setBunnies(parsed.bunnies);
    setTimeLeft(LEVELS[idx].timeLimit);
    setMessage(LEVELS[idx].message);
    if (!keepScore) setScore(0);
    if (!keepLives) setLives(3);
    setScreen("playing");
  };

  const startGame = () => {
    setLevelIndex(0);
    setScore(0);
    setLives(3);
    initLevel(0, false, false);
  };

  const restartLevel = () => {
    initLevel(levelIndex, true, true);
  };

  const loseLife = (reason) => {
    beep(180, 0.2, "sawtooth");
    setMessage(reason);
    setLives((prev) => {
      const next = prev - 1;
      if (next <= 0) {
        setScreen("gameover");
        return 0;
      }
      setTimeout(() => initLevel(levelIndex, true, true), 550);
      return next;
    });
  };

  const tryMove = (dx, dy) => {
    if (dx < 0) setPlayerDirection("left");
    if (dx > 0) setPlayerDirection("right");
    if (screen !== "playing") return;
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (!isWalkable(levelData, nx, ny)) return;

    setPlayer({ x: nx, y: ny });

    setEggs((prev) =>
      prev.map((egg) => {
        if (!egg.collected && egg.x === nx && egg.y === ny) {
          beep(700, 0.12, "triangle");
          setScore((s) => s + 100 + Math.max(0, timeLeft));
          setMessage("Egg-cellent! Mio found another Easter egg.");
          return { ...egg, collected: true };
        }
        return egg;
      })
    );

    if (levelData.traps.some((t) => t.x === nx && t.y === ny)) {
      loseLife("Oops! Mio stepped on a sneaky spring trap.");
      return;
    }

    const allCollected = eggs.every((e) => e.collected || (e.x === nx && e.y === ny));
    if (nx === levelData.exit.x && ny === levelData.exit.y) {
      if (!allCollected) {
        setMessage("The exit basket opens only after every egg is collected.");
        beep(260, 0.1, "square");
      } else {
        const bonus = timeLeft * 10 + 250;
        const newScore = score + bonus;
        setScore(newScore);
        beep(880, 0.16, "triangle");
        beep(1046, 0.2, "triangle");
        if (levelIndex < LEVELS.length - 1) {
          setScreen("levelclear");
          setMessage(`Pawsome! Mio cleared ${level.name} with a ${bonus} point bonus.`);
        } else {
          setScreen("victory");
          setMessage("Mio filled the Easter basket and won the spring adventure!");
          const best = Math.max(bestScore, newScore);
          setBestScore(best);
          localStorage.setItem("mio-easter-best", String(best));
        }
      }
    }
  };

  useEffect(() => {
    if (screen !== "playing") return;
    const onKeyDown = (e) => {
      const keyMap = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
      if (keyMap[e.key]) {
        e.preventDefault();
        tryMove(...keyMap[e.key]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, player, eggs, timeLeft, score, levelIndex, levelData]);

  useEffect(() => {
    if (screen !== "playing") return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          loseLife("Time's up! The Easter bunny zipped away with the clock.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [screen, levelIndex]);

  useEffect(() => {
    if (screen !== "playing") return;
    const bunnyTimer = setInterval(() => {
      setBunnies((prev) =>
        prev.map((bunny) => {
          let nx = bunny.x;
          let ny = bunny.y;
          let ndir = bunny.dir;

          if (bunny.axis === "x") {
            nx += bunny.dir;
            if (!isWalkable(levelData, nx, ny) || levelData.walls[ny][nx] === "X") {
              ndir = -bunny.dir;
              nx = bunny.x + ndir;
            }
          } else {
            ny += bunny.dir;
            if (!isWalkable(levelData, nx, ny) || levelData.walls[ny][nx] === "X") {
              ndir = -bunny.dir;
              ny = bunny.y + ndir;
            }
          }

          return { ...bunny, x: nx, y: ny, dir: ndir };
        })
      );
    }, 500);
    return () => clearInterval(bunnyTimer);
  }, [screen, levelIndex, levelData]);

  useEffect(() => {
    if (screen !== "playing") return;
    const hit = bunnies.some((b) => b.x === player.x && b.y === player.y);
    if (hit) loseLife("Boop! A bunny bumped Mio off the trail.");
  }, [bunnies, player, screen]);

  const nextLevel = () => {
    const next = clamp(levelIndex + 1, 0, LEVELS.length - 1);
    setLevelIndex(next);
    initLevel(next, true, true);
  };
  const boardWidth = levelData.width * cellSize + (levelData.width - 1) * 4;
  const boardHeight = levelData.height * cellSize + (levelData.height - 1) * 4;
  const mobileBoardStyle = isMobile
    ? {
        width: `${boardWidth}px`,
        height: `${boardHeight}px`,
        maxWidth: "100%",
        maxHeight: "100%",
      }
    : undefined;

  const renderCell = (x, y) => {
    const cell = levelData.walls[y][x];
    const isPlayer = player.x === x && player.y === y;
    const egg = eggs.find((e) => e.x === x && e.y === y && !e.collected);
    const bunny = bunnies.find((b) => b.x === x && b.y === y);
    const trap = levelData.traps.find((t) => t.x === x && t.y === y);
    const isExit = levelData.exit.x === x && levelData.exit.y === y;

    let classes = "relative flex items-center justify-center rounded-xl border border-white/30 shadow-sm overflow-hidden";
    let bg = "bg-emerald-100";

    if (cell === "#") bg = "bg-gradient-to-br from-pink-300 to-rose-300 border-pink-200";
    else if (isExit) bg = "bg-gradient-to-br from-amber-100 to-yellow-200";
    else if (trap) bg = "bg-gradient-to-br from-lime-100 to-pink-100";
    else bg = "bg-gradient-to-br from-green-100 to-emerald-50";

    return (
      <motion.div
        key={`${x}-${y}`}
        layout
        className={`${classes} ${bg}`}
        style={{ width: cellSize, height: cellSize }}
        initial={{ scale: 0.9, opacity: 0.8 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.18 }}
      >
        {cell !== "#" && (
          <>
            <div className="absolute inset-0 pointer-events-none opacity-40">
              <div className="absolute left-1 top-1 text-[10px]">🌼</div>
              <div className="absolute right-1 bottom-1 text-[10px]">🌿</div>
            </div>
            {egg && <div className="text-lg animate-bounce">🥚</div>}
            {bunny && <div className="text-lg">🐇</div>}
            {trap && <div className="text-sm">🌸</div>}
            {isExit && <div className="text-lg">🧺</div>}
            {isPlayer && (
              <motion.div
                className="absolute"
                initial={{ scale: 0.7 }}
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 0.35 }}
              >
                <MioSprite direction={playerDirection} />
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    );
  };

  return (
    <div
      className={`w-full bg-gradient-to-br from-pink-100 via-amber-50 to-emerald-100 ${isMobile ? "fixed inset-0 overflow-hidden p-0 overscroll-none touch-manipulation" : "min-h-screen p-4 md:p-8"}`}
    >
      <div className={`mx-auto max-w-7xl ${isMobile ? "h-full" : "grid gap-6 lg:grid-cols-[360px_1fr]"}`}>
        {!isMobile && (
          <Card className="rounded-3xl border-white/60 bg-white/80 backdrop-blur shadow-xl">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-pink-100 px-3 py-1 text-sm font-medium text-pink-700 mb-3">
                    <Cat className="h-4 w-4" /> Mio's Easter Maze
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-800">Help Mio find all the Easter eggs!</h1>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Guide Mio through cheerful spring mazes, collect every egg, dodge bunnies, and dash to the basket exit.</p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-2xl"
                  onClick={() => setSoundOn((s) => !s)}
                >
                  {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={<Egg className="h-4 w-4" />} label="Eggs" value={`${collectedCount}/${totalEggs}`} />
                <StatCard icon={<Clock3 className="h-4 w-4" />} label="Time" value={`${timeLeft}s`} />
                <StatCard icon={<Trophy className="h-4 w-4" />} label="Score" value={score} />
                <StatCard icon={<Heart className="h-4 w-4" />} label="Lives" value={lives} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Level {levelIndex + 1} of {LEVELS.length}</span>
                  <span>{level.name}</span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>

              <div className="rounded-3xl bg-gradient-to-r from-yellow-100 to-pink-100 p-4 text-sm leading-6 text-slate-700 border border-white/60">
                <div className="font-semibold text-slate-800 mb-1">Mio says</div>
                {message}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button className="rounded-2xl h-12" onClick={startGame}>
                  <Play className="mr-2 h-4 w-4" /> New Game
                </Button>
                <Button variant="outline" className="rounded-2xl h-12" onClick={restartLevel}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Restart Level
                </Button>
              </div>

              <div className="rounded-3xl border border-dashed border-pink-200 bg-white/70 p-4 text-sm text-slate-600 space-y-2">
                <p><span className="font-semibold text-slate-800">Controls:</span> Arrow keys on desktop or use the arrow pad on mobile.</p>
                <p><span className="font-semibold text-slate-800">Goal:</span> Collect all eggs before reaching the basket exit.</p>
                <p><span className="font-semibold text-slate-800">Watch out:</span> Hopping bunnies and spring traps can cost a life.</p>
                <p><span className="font-semibold text-slate-800">Best Score:</span> {bestScore}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className={isMobile ? "h-full" : "space-y-6"}>
          <Card className={`border-white/60 bg-white/75 backdrop-blur shadow-xl overflow-hidden ${isMobile ? "h-full rounded-none border-0 shadow-none" : "rounded-3xl"}`}>
            <CardContent className={isMobile ? "h-full p-0" : "p-4 md:p-6"}>
              <div className={isMobile ? "flex h-full min-h-0 flex-col" : "block"}>
                {isMobile && (
                  <div className="flex items-center justify-between gap-3 border-b border-white/60 bg-white/85 px-4 py-3 backdrop-blur" style={{ paddingTop: SAFE_TOP }}>
                    <div className="min-w-0">
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-pink-600">Mio's Easter Maze</div>
                      <div className="truncate text-sm font-semibold text-slate-800">Level {levelIndex + 1}: {level.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CompactPill icon={<Egg className="h-3.5 w-3.5" />} value={`${collectedCount}/${totalEggs}`} />
                      <CompactPill icon={<Clock3 className="h-3.5 w-3.5" />} value={`${timeLeft}s`} />
                      <CompactPill icon={<Heart className="h-3.5 w-3.5" />} value={lives} />
                    </div>
                  </div>
                )}

                <div className={isMobile ? "flex flex-1 min-h-0 flex-col" : "block"}>
                  <div
                    className={`w-full rounded-3xl bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.9),_rgba(255,245,250,0.6),_rgba(237,255,244,0.6))] border border-white/60 ${isMobile ? "flex-1 min-h-0 overflow-hidden rounded-none border-0 p-3" : "overflow-auto p-3 md:p-4"}`}
                  >
                    <div className="flex h-full w-full items-center justify-center overflow-hidden">
                      <div
                        className="grid gap-1 mx-auto select-none"
                        style={{
                          gridTemplateColumns: `repeat(${levelData.width}, ${cellSize}px)`,
                          ...mobileBoardStyle,
                        }}
                      >
                        {Array.from({ length: levelData.height }).flatMap((_, y) =>
                          Array.from({ length: levelData.width }).map((__, x) => renderCell(x, y))
                        )}
                      </div>
                    </div>
                  </div>

                  {isMobile && (
                    <div className="border-t border-white/60 bg-white/90 px-4 py-3 backdrop-blur supports-[padding:max(0px)]:pb-[calc(12px+env(safe-area-inset-bottom))]">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <CompactPill icon={<Trophy className="h-3.5 w-3.5" />} value={score} />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-2xl bg-white/90"
                          onClick={() => setSoundOn((s) => !s)}
                        >
                          {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                        </Button>
                      </div>
                      <MobileControls onMove={tryMove} />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {!isMobile && (
            <div className="grid gap-4 md:grid-cols-3">
              <MiniLegend sprite label="Mio" description="Your intelligent cat mascot" />
              <MiniLegend emoji="🥚" label="Eggs" description="Collect them all" />
              <MiniLegend emoji="🧺" label="Exit" description="Unlocks after all eggs" />
            </div>
          )}
        </div>
      </div>

      {(screen === "intro" || screen === "levelclear" || screen === "victory" || screen === "gameover") && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-2xl border border-white/60"
          >
            <div className="text-center space-y-4">
              <div className="text-6xl">
                {screen === "victory" ? "🎉" : screen === "gameover" ? "😿" : "🌷"}
              </div>
              <Badge className="rounded-full px-4 py-1 text-sm bg-pink-100 text-pink-700 hover:bg-pink-100">
                {screen === "intro" && "Spring Adventure"}
                {screen === "levelclear" && "Level Cleared"}
                {screen === "victory" && "Basket Filled"}
                {screen === "gameover" && "Try Again"}
              </Badge>
              <h2 className="text-3xl font-bold text-slate-800">
                {screen === "intro" && "Help Mio find all the Easter eggs!"}
                {screen === "levelclear" && `${level.name} complete!`}
                {screen === "victory" && "Mio saved Easter!"}
                {screen === "gameover" && "The maze won this round"}
              </h2>
              <p className="text-slate-600 leading-7">{message}</p>

              <div className="grid grid-cols-3 gap-3 text-left">
                <StatCard icon={<Trophy className="h-4 w-4" />} label="Score" value={score} compact />
                <StatCard icon={<Heart className="h-4 w-4" />} label="Lives" value={lives} compact />
                <StatCard icon={<Egg className="h-4 w-4" />} label="Level" value={levelIndex + 1} compact />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {screen === "intro" && (
                  <Button className="rounded-2xl h-12 px-6" onClick={startGame}>
                    <Play className="mr-2 h-4 w-4" /> Start Game
                  </Button>
                )}
                {screen === "levelclear" && (
                  <Button className="rounded-2xl h-12 px-6" onClick={nextLevel}>
                    <ChevronRight className="mr-2 h-4 w-4" /> Next Level
                  </Button>
                )}
                {(screen === "victory" || screen === "gameover") && (
                  <Button className="rounded-2xl h-12 px-6" onClick={startGame}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Play Again
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function MobileControls({ onMove }) {
  const btnClass = "h-14 w-14 rounded-2xl bg-white/95 shadow-md border border-white/80 text-slate-700 active:scale-95 text-2xl font-semibold";

  return (
    <div className="mx-auto flex w-full max-w-[220px] flex-col items-center gap-2">
      <Button variant="outline" className={btnClass} onClick={() => onMove(0, -1)} aria-label="Move up">
        ↑
      </Button>
      <div className="flex w-full items-center justify-between gap-2">
        <Button variant="outline" className={btnClass} onClick={() => onMove(-1, 0)} aria-label="Move left">
          ←
        </Button>
        <Button variant="outline" className={btnClass} onClick={() => onMove(1, 0)} aria-label="Move right">
          →
        </Button>
      </div>
      <Button variant="outline" className={btnClass} onClick={() => onMove(0, 1)} aria-label="Move down">
        ↓
      </Button>
    </div>
  );
}

function CompactPill({ icon, value }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-pink-50 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
      {icon}
      <span>{value}</span>
    </div>
  );
}

function StatCard({ icon, label, value, compact = false }) {
  return (
    <div className={`rounded-2xl border border-white/60 bg-gradient-to-br from-white to-pink-50 shadow-sm ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wide">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`${compact ? "text-lg" : "text-2xl"} font-bold text-slate-800 mt-2`}>{value}</div>
    </div>
  );
}

function MiniLegend({ emoji, image, sprite, label, description }) {
  return (
    <Card className="rounded-3xl border-white/60 bg-white/75 backdrop-blur shadow-md">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-emerald-100 text-2xl overflow-hidden">
          {sprite ? <MioSprite className="scale-[1.55]" /> : image ? <img src={image} alt={label} className="h-full w-full object-cover" /> : emoji}
        </div>
        <div>
          <div className="font-semibold text-slate-800">{label}</div>
          <div className="text-sm text-slate-600">{description}</div>
        </div>
      </CardContent>
    </Card>
  );
}
