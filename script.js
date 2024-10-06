const API_KEY = 'Uue68gNzIk904LKfUmQBz2ehD9uIcajhDwbnx66g'; // Replace with your own API key
let scene, camera, renderer, controls, tooltip, neos = [];

// Fetch Near-Earth Object data
async function fetchNEOData() {
    const cachedData = localStorage.getItem('neoData');
    const cacheTime = localStorage.getItem('neoDataTime');
    const currentTime = Date.now();

    // Check if cached data is available and is still valid (1 hour)
    if (cachedData && cacheTime && (currentTime - cacheTime < 3600000)) {
        console.log('Using cached NEO data.');
        return JSON.parse(cachedData);
    }

    try {
        const response = await fetch(`https://api.nasa.gov/neo/rest/v1/neo/browse?api_key=${API_KEY}`);
        if (!response.ok) {
            // Handle different error responses
            if (response.status === 429) {
                console.error('Rate limit exceeded. Please wait before trying again.');
                return []; // Return an empty array to avoid further errors
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.near_earth_objects) {
            console.error('No near-earth objects found in the response.');
            return []; // Return an empty array if the expected data is not present
        }

        const detailedNEOs = await Promise.all(data.near_earth_objects.map(async (neo) => {
            const neoDetailsResponse = await fetch(`https://api.nasa.gov/neo/rest/v1/neo/${neo.id}?api_key=${API_KEY}`);
            if (!neoDetailsResponse.ok) {
                console.warn(`Error fetching details for NEO ${neo.name}: ${neoDetailsResponse.status}`);
                return null; // Return null for errors to filter them out later
            }
            return await neoDetailsResponse.json(); // Return detailed NEO information
        }));

        // Filter out any null values returned from failed fetches
        const validNEOs = detailedNEOs.filter(neo => neo !== null); // Return array of detailed NEOs

        // Cache the valid NEOs and the current timestamp
        localStorage.setItem('neoData', JSON.stringify(validNEOs));
        localStorage.setItem('neoDataTime', currentTime);

        return validNEOs; // Return the filtered array of detailed NEOs
    } catch (error) {
        console.error('Error fetching NEO data:', error);
        return []; // Return an empty array in case of an error
    }
}

// Set up Three.js
function initThreeJS() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    // Add point light
    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    camera.position.set(0, 0, 5);
    
    tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    document.body.appendChild(tooltip);
}

// Function to create a sphere
function createSphere(radius, color) {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({ color });
    return new THREE.Mesh(geometry, material);
}

// Initialize legend
const legend = document.createElement('div');
legend.style.position = 'absolute';
legend.style.top = '10px';
legend.style.left = '10px';
legend.style.color = '#fff';
legend.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
legend.style.padding = '10px';
legend.style.borderRadius = '5px';
legend.style.fontSize = '14px';
document.body.appendChild(legend);

// Function to render the scene
function render() {
    requestAnimationFrame(render);
    controls.update();
    renderer.render(scene, camera);
}

// Main function to initialize the orrery
let time = 0; // Variable to keep track of time

// Updated init function to assign unique colors and ensure NEOs are moving
async function init() {
    neos = await fetchNEOData();
    console.log("Fetched NEOs:", neos);

    const sun = createSphere(1, 0xffff00); // Create the sun
    scene.add(sun);

    // Clear legend
    legend.innerHTML = '<strong>Legend:</strong><br>'; // Initialize legend with title

    neos.forEach((neo, index) => {
        const radius = 0.5; // Use a larger radius for visibility
        const color = (index + 1) * 0x111111; // Assign unique colors based on index for consistency
        const sphere = createSphere(radius, color);
        
        // Set a visible position for testing
        sphere.position.set(index * 2, Math.sin(index) * 2, Math.cos(index) * 2);
        sphere.orbitRadius = index * 2; // Store the orbit radius
        sphere.orbitSpeed = 0.01 * (index + 1); // Vary speed based on index
        
        // Set user data for the tooltip
        sphere.userData = {
            name: neo.name,
            size: neo.estimated_diameter.meters.estimated_diameter_max // Size for tooltip
        };

        scene.add(sphere);

        // Add legend entry for this NEO
        const legendItem = document.createElement('div');
        legendItem.style.color = `#${color.toString(16).padStart(6, '0')}`; // Use the same color for the NEO
        legendItem.textContent = neo.name;
        legend.appendChild(legendItem);

        // Log NEO name and position for confirmation
        console.log(`Added NEO: ${neo.name}, Position:`, sphere.position);
    });

    // Position camera
    camera.position.set(0, 10, 10); // Change to a better position for visibility
    camera.lookAt(0, 0, 0);

    // Set background color
    scene.background = new THREE.Color(0x000000);

    render();
}

// Ensure correct render function without duplication
function render() {
    requestAnimationFrame(render);
    
    // Update NEO positions for animation
    time += 0.01; // Increment time for animation
    scene.children.forEach(child => {
        if (child.orbitRadius) { // Check if it's a NEO
            child.position.x = child.orbitRadius * Math.cos(time * child.orbitSpeed);
            child.position.z = child.orbitRadius * Math.sin(time * child.orbitSpeed);
        }
    });

    controls.update();
    renderer.render(scene, camera);
}


// Tooltip functions
function showTooltip(event, data) {
    tooltip.style.display = 'block';
    tooltip.innerHTML = `${data.name} - Size: ${data.size.toFixed(2)} m`;
    tooltip.style.left = `${event.clientX + 10}px`;
    tooltip.style.top = `${event.clientY + 10}px`;
}

function hideTooltip() {
    tooltip.style.display = 'none';
}

// Set up window resize handling and mouse event handling
async function runApp() {
    initThreeJS();
    await init();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    renderer.domElement.addEventListener('mousemove', (event) => {
        event.preventDefault();
        const mouse = new THREE.Vector2();
        const raycaster = new THREE.Raycaster();

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(scene.children);
        if (intersects.length > 0) {
            const intersectedObject = intersects[0].object;
            if (intersectedObject.userData.name) {
                showTooltip(event, intersectedObject.userData);
            }
        } else {
            hideTooltip();
        }
    });
}

// Initialize everything
runApp();
