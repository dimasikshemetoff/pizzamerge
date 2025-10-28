// --- Инициализация Matter.js ---
const { Engine, Render, Runner, World, Bodies, Body, Events, Composite, Sleeping } = Matter;

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
// Y-координата "линии проигрыша"
const LOSE_LINE_Y = 150; // Увеличил для безопасности

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
let scaleFactor = 1; // Масштабный коэффициент для адаптации к размеру экрана

// --- Функция для изменения размера canvas ---
function resizeCanvas() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Определяем новый размер игрового поля с сохранением пропорций
    let newWidth, newHeight;
    
    if (windowHeight / windowWidth > GAME_ASPECT_RATIO) {
        // Экран более высокий, чем наша игра
        newWidth = windowWidth;
        newHeight = windowWidth * GAME_ASPECT_RATIO;
    } else {
        // Экран более широкий, чем наша игра
        newHeight = windowHeight;
        newWidth = windowHeight / GAME_ASPECT_RATIO;
    }
    
    // Обновляем масштабный коэффициент
    scaleFactor = newWidth / GAME_WIDTH;
    
    // Обновляем размер контейнера
    gameContainer.style.width = `${newWidth}px`;
    gameContainer.style.height = `${newHeight}px`;
    
    // Если рендер уже создан, обновляем его размер
    if (render) {
        render.canvas.width = newWidth;
        render.canvas.height = newHeight;
        render.options.width = newWidth;
        render.options.height = newHeight;
        
        // Пересоздаем границы с новым размером
        updateBoundaries(newWidth, newHeight);
    }
    
    return { width: newWidth, height: newHeight };
}

// --- Обновление границ игрового поля ---
function updateBoundaries(width, height) {
    // Удаляем старые границы
    const bodies = Composite.allBodies(world);
    const boundaries = bodies.filter(body => 
        body.label === 'boundary' || 
        body.label === 'loseLine'
    );
    
    boundaries.forEach(boundary => {
        World.remove(world, boundary);
    });
    
    // Создаем новые границы
    const wallOptions = { 
        isStatic: true, 
        render: { fillStyle: '#8B4513' },
        chamfer: { radius: 10 },
        label: 'boundary'
    };
    
    World.add(world, [
        // Пол
        Bodies.rectangle(width / 2, height - 10, width, 20, wallOptions),
        // Левая стена
        Bodies.rectangle(10, height / 2, 20, height, wallOptions),
        // Правая стена
        Bodies.rectangle(width - 10, height / 2, 20, height, wallOptions)
    ]);
    
    // Добавляем "линию проигрыша" (невидимую)
    const loseLineY = LOSE_LINE_Y * scaleFactor;
    const loseLine = Bodies.rectangle(width / 2, loseLineY, width, 2, {
        isStatic: true,
        isSensor: true,
        label: 'loseLine',
        render: { fillStyle: '#ff0000', opacity: 0.5 } // Полупрозрачная для отладки
    });
    World.add(world, loseLine);
}

// --- Инициализация игры ---
function init() {
    // Сброс состояния
    isGameOver = false;
    score = 0;
    disableDrop = false;
    updateScoreUI();
    highScoreElement.textContent = highScore;
    gameOverModal.classList.add('hidden');

    // Изменяем размер canvas под экран
    const { width, height } = resizeCanvas();

    // --- Настройка движка ---
    engine = Engine.create({
        enableSleeping: true,
        positionIterations: 6,
        velocityIterations: 4,
        constraintIterations: 2
    });
    world = engine.world;
    world.gravity.y = 1.0;

    // --- Настройка рендера ---
    render = Render.create({
        element: gameContainer,
        engine: engine,
        options: {
            width: width,
            height: height,
            wireframes: false,
            background: 'transparent',
            showSleeping: false // Отключаем визуальное отображение "спящих" объектов
        }
    });

    // --- Создание границ ---
    updateBoundaries(width, height);

    // --- Запуск движка и рендера ---
    runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    // --- Добавляем слушатели событий ---
    addEventListeners();

    // --- Создаем первую пиццу ---
    spawnNextPizza();
}

// --- Создание пиццы ---
function createPizza(x, y, level) {
    const pizzaData = PIZZA_TYPES[level - 1];
    if (!pizzaData) return;

    // Масштабируем радиус пиццы
    const scaledRadius = pizzaData.radius * scaleFactor;

    // Вычисляем правильный масштаб для изображения
    // Предполагаем, что исходные изображения имеют размер 200x200 пикселей
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
            opacity: 1 // Устанавливаем полную непрозрачность
        }
    });
    
    // Разбудить тело
    Sleeping.set(pizza, false);
    
    return pizza;
}

// --- Создание следующей пиццы ---
function spawnNextPizza() {
    if (isGameOver) return;
    
    const nextLevel = Math.floor(Math.random() * STARTING_LEVELS) + 1;
    const canvasWidth = render.canvas.width;
    currentPizza = createPizza(canvasWidth / 2, 50, nextLevel);
    
    // Делаем ее статичной и сенсором
    Body.setStatic(currentPizza, true);
    currentPizza.isSensor = true;
    
    World.add(world, currentPizza);
}

// --- Бросок пиццы ---
function dropCurrentPizza(x) {
    if (!currentPizza || disableDrop || isGameOver) return;

    disableDrop = true;
    
    // Делаем пиццу динамической
    Body.setStatic(currentPizza, false);
    currentPizza.isSensor = false;

    // Устанавливаем позицию и будим
    Body.setPosition(currentPizza, { x: x, y: currentPizza.position.y });
    Sleeping.set(currentPizza, false);

    // Будим все пиццы на поле
    const allPizzas = Composite.allBodies(world).filter(b => b.label === 'pizza');
    allPizzas.forEach(pizza => {
        if (pizza !== currentPizza) {
            Sleeping.set(pizza, false);
            // Добавляем небольшое случайное движение для пробуждения
            Body.setVelocity(pizza, {
                x: (Math.random() - 0.5) * 0.1,
                y: (Math.random() - 0.5) * 0.1
            });
        }
    });

    currentPizza = null;

    // Задержка перед следующей пиццей
    setTimeout(() => {
        disableDrop = false;
        spawnNextPizza();
    }, 500);
}

// --- Обработка столкновений ---
function handleCollision(event) {
    if (isGameOver) return;

    const pairs = event.pairs;
    let merges = [];
    const bodiesToRemove = new Set();

    for (const pair of pairs) {
        const { bodyA, bodyB } = pair;

        // Проверяем, что оба тела - пиццы, одного уровня и не достигли максимального уровня
        if (bodyA.label === 'pizza' && bodyB.label === 'pizza' &&
            bodyA.level === bodyB.level &&
            bodyA.level < MAX_LEVEL) {
            
            // Исключаем слияние с текущей пиццей (в предпросмотре)
            if (bodyA === currentPizza || bodyB === currentPizza) continue;
                
            if (bodiesToRemove.has(bodyA) || bodiesToRemove.has(bodyB)) continue;

            bodiesToRemove.add(bodyA);
            bodiesToRemove.add(bodyB);

            const newLevel = bodyA.level + 1;
            const pizzaData = PIZZA_TYPES[newLevel - 1];

            score += pizzaData.score;
            
            // Позиция для новой пиццы
            const newX = (bodyA.position.x + bodyB.position.x) / 2;
            const newY = (bodyA.position.y + bodyB.position.y) / 2;

            const newPizza = createPizza(newX, newY, newLevel);
            
            // Наследуем скорость
            Body.setVelocity(newPizza, {
                x: (bodyA.velocity.x + bodyB.velocity.x) / 2,
                y: (bodyA.velocity.y + bodyB.velocity.y) / 2
            });
            
            // Будим новую пиццу
            Sleeping.set(newPizza, false);
            
            // Будим ВСЕ пиццы на поле при слиянии
            const allPizzas = Composite.allBodies(world).filter(b => b.label === 'pizza');
            allPizzas.forEach(pizza => {
                if (pizza !== newPizza) {
                    Sleeping.set(pizza, false);
                    // Добавляем небольшое случайное движение для пробуждения
                    Body.setVelocity(pizza, {
                        x: (Math.random() - 0.5) * 0.1,
                        y: (Math.random() - 0.5) * 0.1
                    });
                }
            });
            
            setTimeout(() => {
                World.add(world, newPizza);
            }, 10);
        }
    }
    
    // Удаляем старые пиццы
    if (bodiesToRemove.size > 0) {
        setTimeout(() => {
            bodiesToRemove.forEach(body => {
                World.remove(world, body);
            });
            updateScoreUI();
        }, 10);
    }
}

// --- Проверка на проигрыш ---
function checkGameOver() {
    if (isGameOver) return;

    const allPizzas = Composite.allBodies(world).filter(b => b.label === 'pizza');
    const loseLineY = LOSE_LINE_Y * scaleFactor;

    for (const pizza of allPizzas) {
        // Проверяем только пиццы, которые не являются текущей и находятся выше линии
        if (pizza !== currentPizza && 
            pizza.position.y <= loseLineY + pizza.circleRadius) {
            
            // Дополнительная проверка - пицца должна быть неподвижной
            // ИСПРАВЛЕНО: Заменяем Sleeping.is(pizza) на pizza.isSleeping
            if (pizza.isSleeping || 
                (Math.abs(pizza.velocity.x) < 0.1 && Math.abs(pizza.velocity.y) < 0.1)) {
                endGame();
                break;
            }
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
    World.clear(world);
    Engine.clear(engine);
    Render.stop(render);
    Runner.stop(runner);
    render.canvas.remove();
    
    init();
}

// --- Слушатели событий ---
function addEventListeners() {
    const canvas = render.canvas;

    // Добавляем обработчик изменения размера окна
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

    // Добавляем поддержку сенсорных экранов
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

    // События движка
    Events.on(engine, 'collisionStart', handleCollision);
    Events.on(engine, 'afterUpdate', checkGameOver);
    
    restartButton.addEventListener('click', restartGame);
}

// --- Запуск игры ---
init();