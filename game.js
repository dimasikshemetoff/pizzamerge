// --- Инициализация Matter.js ---
const { Engine, Render, Runner, World, Bodies, Body, Events, Composite, Query, Vector } = Matter;

// --- DOM Элементы ---
const gameContainer = document.getElementById('game-container');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const gameOverModal = document.getElementById('game-over-modal');
const finalScoreElement = document.getElementById('final-score');
const restartButton = document.getElementById('restart-button');

// --- Константы игры ---
const GAME_WIDTH = 600;
const GAME_HEIGHT = 800;
const GAME_ASPECT_RATIO = GAME_HEIGHT / GAME_WIDTH;

// --- Определение 15 видов пицц с изображениями ---
const PIZZA_TYPES = [
    { level: 1,  radius: 40, score: 1, image: 'first.png' },
    { level: 2,  radius: 60, score: 3, image: 'two.png' },
    { level: 3,  radius: 70, score: 6, image: 'three.png' },
    { level: 4,  radius: 80, score: 10, image: 'four.png' },
    { level: 5,  radius: 90, score: 15, image: 'five.png' },
    { level: 6,  radius: 100, score: 21, image: 'six.png' },
    { level: 7,  radius: 110, score: 28, image: 'seven.png' },
    { level: 8,  radius: 120, score: 36, image: 'eight.png' },
    { level: 9,  radius: 130, score: 45, image: 'nine.png' },
    { level: 10, radius: 140, score: 55, image: 'ten.png' },
    { level: 11, radius: 150, score: 66, image: 'eleven.png' },
    { level: 12, radius: 160, score: 78, image: 'twelve.png' },
    { level: 13, radius: 170, score: 91, image: 'thirdteen.png' },
    { level: 14, radius: 180, score: 105, image: 'fourteen.png' },
    { level: 15, radius: 190, score: 120, image: 'fiveteen.png' }
];
const MAX_LEVEL = PIZZA_TYPES.length;
const STARTING_LEVELS = 3;

// --- Игровые переменные ---
let engine, world, render, runner;
let score = 0;
let highScore = localStorage.getItem('pizza-highscore') || 0;
let isGameOver = false;
let currentPizza = null;
let disableDrop = false;
let scaleFactor = 1;
let pendingMerges = new Map(); // Для отслеживания ожидающих слияний

// --- Функция для изменения размера canvas ---
function resizeCanvas() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let newWidth, newHeight;
    
    if (windowWidth <= 425) {
        newWidth = windowWidth;
        newHeight = windowHeight;
    } else {
        newHeight = windowHeight;
        newWidth = windowHeight / GAME_ASPECT_RATIO;
    }
    
    const oldScaleFactor = scaleFactor;
    scaleFactor = newWidth / GAME_WIDTH;
    
    gameContainer.style.width = `${newWidth}px`;
    gameContainer.style.height = `${newHeight}px`;
    
    if (render) {
        render.canvas.width = newWidth;
        render.canvas.height = newHeight;
        render.options.width = newWidth;
        render.options.height = newHeight;
        
        updateBoundaries(newWidth, newHeight);
        
        // ИСПРАВЛЕННЫЙ КОД ДЛЯ ИЗМЕНЕНИЯ РАЗМЕРА ПИЦЦ
        const allPizzas = Composite.allBodies(world).filter(b => b.label === 'pizza');
        allPizzas.forEach(pizza => {
            // Вычисляем коэффициент изменения масштаба
            const scaleChange = scaleFactor / oldScaleFactor;
            
            // Используем встроенную функцию Matter.js для масштабирования тела
            Body.scale(pizza, scaleChange, scaleChange);
            
            // Обновляем масштаб спрайта
            const pizzaData = PIZZA_TYPES[pizza.level - 1];
            if (pizzaData) {
                const newRadius = pizzaData.radius * scaleFactor;
                const imageScaleFactor = (newRadius * 2) / 565;
                pizza.render.sprite.xScale = imageScaleFactor;
                pizza.render.sprite.yScale = imageScaleFactor;
            }
        });
        
        // Если есть текущая пицца, также обновляем её
        if (currentPizza) {
            const scaleChange = scaleFactor / oldScaleFactor;
            Body.scale(currentPizza, scaleChange, scaleChange);
            
            const pizzaData = PIZZA_TYPES[currentPizza.level - 1];
            if (pizzaData) {
                const newRadius = pizzaData.radius * scaleFactor;
                const imageScaleFactor = (newRadius * 2) / 565;
                currentPizza.render.sprite.xScale = imageScaleFactor;
                currentPizza.render.sprite.yScale = imageScaleFactor;
            }
        }
    }
    
    return { width: newWidth, height: newHeight };
}

// --- Обновление границ игрового поля ---
function updateBoundaries(width, height) {
    const bodies = Composite.allBodies(world);
    const boundaries = bodies.filter(body => body.label === 'boundary');
    
    boundaries.forEach(boundary => World.remove(world, boundary));
    
    const wallOptions = { 
        isStatic: true, 
        render: { fillStyle: '#8B4513' },
        chamfer: { radius: 10 },
        label: 'boundary'
    };
    
    World.add(world, [
        Bodies.rectangle(width / 2, height - 10, width, 20, wallOptions),
        Bodies.rectangle(10, (height * 0.25 + height) / 2, 20, height - height * 0.25, wallOptions),
        Bodies.rectangle(width - 10, (height * 0.25 + height) / 2, 20, height - height * 0.25, wallOptions)
    ]);
    
    console.log(`Границы обновлены: ширина=${width}, высота=${height}`);
}

// --- Инициализация игры ---
function init() {
    console.log("Инициализация игры");
    isGameOver = false;
    score = 0;
    disableDrop = false;
    pendingMerges.clear();
    updateScoreUI();
    highScoreElement.textContent = highScore;
    gameOverModal.classList.add('hidden');

    const { width, height } = resizeCanvas();

    engine = Engine.create({
        enableSleeping: false,
        positionIterations: 6,
        velocityIterations: 4,
        constraintIterations: 2
    });
    world = engine.world;
    world.gravity.y = 1.0;

    render = Render.create({
        element: gameContainer,
        engine: engine,
        options: {
            width: width,
            height: height,
            wireframes: false,
            background: 'transparent'
        }
    });

    updateBoundaries(width, height);

    runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    addEventListeners();
    spawnNextPizza();
}

// --- Создание пиццы ---
function createPizza(x, y, level) {
    const pizzaData = PIZZA_TYPES[level - 1];
    if (!pizzaData) return;

    const scaledRadius = pizzaData.radius * scaleFactor;
    const imageScaleFactor = (scaledRadius * 2) / 565;

    const pizza = Bodies.circle(x, y, scaledRadius, {
        label: 'pizza',
        level: pizzaData.level,
        restitution: 0.2,
        friction: 0.1,
        density: 0.001,
        render: {
            sprite: {
                texture: `./assets/${pizzaData.image}`,
                xScale: imageScaleFactor,
                yScale: imageScaleFactor
            },
            opacity: 1
        }
    });
    
    return pizza;
}

// --- НОВАЯ Функция для проверки столкновений при спавне ---
function findSafeSpawnPosition(desiredX, desiredY, radius) {
    let safeY = desiredY;
    const maxAttempts = 20;
    const yIncrement = 30 * scaleFactor;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const testPosition = Vector.create(desiredX, safeY);
        const collisions = Query.point(Composite.allBodies(world), testPosition);
        
        const hasCollision = collisions.some(body => 
            body.label === 'pizza' && 
            Vector.magnitude(Vector.sub(body.position, testPosition)) < (body.circleRadius + radius)
        );
        
        if (!hasCollision) {
            return safeY;
        }
        
        safeY -= yIncrement;
        if (safeY < radius) {
            // Достигли верха, возвращаем исходную позицию
            return desiredY;
        }
    }
    
    return desiredY;
}

// --- Создание следующей пиццы ---
function spawnNextPizza() {
    if (isGameOver) return;
    
    const nextLevel = Math.floor(Math.random() * STARTING_LEVELS) + 1;
    const canvasWidth = render.canvas.width;
    const canvasHeight = render.canvas.height;
    
    const desiredY = canvasHeight * 0.1;
    const pizzaRadius = PIZZA_TYPES[nextLevel - 1].radius * scaleFactor;
    
    // Находим безопасную позицию для спавна
    const safeY = findSafeSpawnPosition(canvasWidth / 2, desiredY, pizzaRadius);
    
    currentPizza = createPizza(canvasWidth / 2, safeY, nextLevel);
    
    Body.setStatic(currentPizza, true);
    currentPizza.isSensor = true;
    
    World.add(world, currentPizza);
    console.log(`Сгенерирована новая пицца уровня ${nextLevel} для броска на высоте ${safeY}`);
}

// --- Бросок пиццы ---
function dropCurrentPizza(x) {
    if (!currentPizza || disableDrop || isGameOver) return;

    console.log(`Бросаем пиццу уровня ${currentPizza.level} в позиции x=${x}`);
    disableDrop = true;
    
    Body.setStatic(currentPizza, false);
    currentPizza.isSensor = false;
    Body.setPosition(currentPizza, { x: x, y: currentPizza.position.y });

    currentPizza = null;

    setTimeout(() => {
        disableDrop = false;
        spawnNextPizza();
    }, 500);
}

// --- Функция для создания эффекта частиц ---
function createParticleEffect(x, y, color = '#FF6B35', count = 15) {
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        const size = Math.random() * 8 + 4;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.backgroundColor = color;
        
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 30 + 10;
        const duration = Math.random() * 0.5 + 0.3;
        
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        
        gameContainer.appendChild(particle);
        
        // Анимация частицы
        const startX = x;
        const startY = y;
        const endX = startX + Math.cos(angle) * distance * scaleFactor;
        const endY = startY + Math.sin(angle) * distance * scaleFactor;
        
        particle.animate([
            { 
                transform: `translate(${startX}px, ${startY}px)`,
                opacity: 1
            },
            { 
                transform: `translate(${endX}px, ${endY}px)`,
                opacity: 0
            }
        ], {
            duration: duration * 1000,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            fill: 'forwards'
        });
        
        // Удаление частицы после анимации
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
        }, duration * 1000);
    }
}

// --- УПРОЩЕННАЯ Обработка столкновений ---
function handleCollision(event) {
    if (isGameOver) return;

    const pairs = event.pairs;

    for (const pair of pairs) {
        const { bodyA, bodyB } = pair;

        // Пропускаем, если пиццы уже ждут слияния
        if (pendingMerges.has(bodyA.id) || pendingMerges.has(bodyB.id)) continue;

        if (bodyA.label === 'pizza' && bodyB.label === 'pizza' &&
            bodyA.level === bodyB.level &&
            bodyA.level < MAX_LEVEL) {
            
            if (bodyA === currentPizza || bodyB === currentPizza) continue;

            // Блокируем пиццы от повторных слияний
            pendingMerges.set(bodyA.id, true);
            pendingMerges.set(bodyB.id, true);

            const newLevel = bodyA.level + 1;
            const pizzaData = PIZZA_TYPES[newLevel - 1];
            score += pizzaData.score;
            
            const newX = (bodyA.position.x + bodyB.position.x) / 2;
            const newY = (bodyA.position.y + bodyB.position.y) / 2;

            // Создаем эффект частиц в месте слияния
            createParticleEffect(
                newX, 
                newY, 
                '#FF6B35', 
                20
            );

            console.log(`Столкновение: две пиццы уровня ${bodyA.level} объединились в пиццу уровня ${newLevel}`);
            
            // Удаляем старые пиццы
            World.remove(world, [bodyA, bodyB]);
            pendingMerges.delete(bodyA.id);
            pendingMerges.delete(bodyB.id);

            // Создаем новую пиццу
            const newPizza = createPizza(newX, newY, newLevel);
            
            // Задаем скорость новой пицце
            Body.setVelocity(newPizza, {
                x: (bodyA.velocity.x + bodyB.velocity.x) / 2,
                y: (bodyA.velocity.y + bodyB.velocity.y) / 2
            });
            
            World.add(world, newPizza);
            
            updateScoreUI();
        }
    }
}

// --- Проверка на проигрыш ---
function checkGameOver() {
    if (isGameOver) return;

    const allPizzas = Composite.allBodies(world).filter(b => b.label === 'pizza');
    const canvasWidth = render.canvas.width;

    const leftWallCenter = 10;
    const rightWallCenter = canvasWidth - 10;

    for (const pizza of allPizzas) {
        if (pizza === currentPizza) continue;

        if (pizza.position.x < leftWallCenter || 
            pizza.position.x > rightWallCenter) {
            
            console.error(`ИГРА ОКОНЧЕНА! Пицца уровня ${pizza.level} вышла за границы.`);
            console.error(`Позиция пиццы: x=${pizza.position.x}, y=${pizza.position.y}`);
            console.error(`Границы: левая=${leftWallCenter}, правая=${rightWallCenter}`);
            console.error(`Радиус пиццы: ${pizza.circleRadius}`);
            
            endGame();
            return;
        }
    }
}

// --- Обновление счета ---
function updateScoreUI() {
    scoreElement.textContent = score;
    if (score > highScore) {
        highScore = score;
        highScoreElement.textContent = highScore;
        localStorage.setItem('pizza-highscore', highScore);
    }
}

// --- Конец игры ---
function endGame() {
    if (isGameOver) return;
    
    console.log(`Конец игры. Финальный счет: ${score}`);
    isGameOver = true;
    
    Runner.stop(runner);
    Render.stop(render);
    
    if (currentPizza) {
        World.remove(world, currentPizza);
        currentPizza = null;
    }

    finalScoreElement.textContent = score;
    gameOverModal.classList.remove('hidden');
}

// --- Перезапуск игры ---
function restartGame() {
    console.log("Перезапуск игры");
    World.clear(world);
    Engine.clear(engine);
    Render.stop(render);
    Runner.stop(runner);
    if (render.canvas) {
        render.canvas.remove();
    }
    
    init();
}

// --- Слушатели событий ---
function addEventListeners() {
    const canvas = render.canvas;

    window.addEventListener('resize', resizeCanvas);

    canvas.addEventListener('mousemove', (event) => {
        if (!currentPizza || isGameOver) return;
        
        const rect = canvas.getBoundingClientRect();
        let x = event.clientX - rect.left;

        const pizzaRadius = PIZZA_TYPES[currentPizza.level - 1].radius * scaleFactor;
        const wallPadding = 20 * scaleFactor;
        x = Math.max(x, wallPadding + pizzaRadius);
        x = Math.min(x, canvas.width - wallPadding - pizzaRadius);
        
        Body.setPosition(currentPizza, { x: x, y: currentPizza.position.y });
    });

    canvas.addEventListener('click', (event) => {
        if (isGameOver || disableDrop) return;
        
        const rect = canvas.getBoundingClientRect();
        let x = event.clientX - rect.left;
        
        const pizzaRadius = currentPizza ? PIZZA_TYPES[currentPizza.level - 1].radius * scaleFactor : 0;
        const wallPadding = 20 * scaleFactor;
        x = Math.max(x, wallPadding + pizzaRadius);
        x = Math.min(x, canvas.width - wallPadding - pizzaRadius);

        dropCurrentPizza(x);
    });

    canvas.addEventListener('touchmove', (event) => {
        if (!currentPizza || isGameOver) return;
        
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = event.touches[0];
        let x = touch.clientX - rect.left;

        const pizzaRadius = PIZZA_TYPES[currentPizza.level - 1].radius * scaleFactor;
        const wallPadding = 20 * scaleFactor;
        x = Math.max(x, wallPadding + pizzaRadius);
        x = Math.min(x, canvas.width - wallPadding - pizzaRadius);
        
        Body.setPosition(currentPizza, { x: x, y: currentPizza.position.y });
    });

    canvas.addEventListener('touchend', (event) => {
        if (isGameOver || disableDrop) return;
        
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = event.changedTouches[0];
        let x = touch.clientX - rect.left;
        
        const pizzaRadius = currentPizza ? PIZZA_TYPES[currentPizza.level - 1].radius * scaleFactor : 0;
        const wallPadding = 20 * scaleFactor;
        x = Math.max(x, wallPadding + pizzaRadius);
        x = Math.min(x, canvas.width - wallPadding - pizzaRadius);

        dropCurrentPizza(x);
    });

    Events.on(engine, 'collisionStart', handleCollision);
    Events.on(engine, 'afterUpdate', checkGameOver);
    
    restartButton.addEventListener('click', restartGame);
}

// --- Запуск игры ---
init();