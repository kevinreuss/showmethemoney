// Main application
const app = {
  // Scene setup
  scene: null,
  camera: null,
  renderer: null,
  controls: null,

  // Physics
  world: null,
  timeStep: 1 / 60,

  // Objects
  bills: [],
  billMesh: null,
  billTexture: null,

  // Configuration
  ENABLE_NAVIGATION: true, // Flag to enable/disable 3D navigation

  // DOM elements
  amountSelect: document.getElementById("amount-select"),
  // renderBtn: document.getElementById("render-btn"),
  infoElement: document.getElementById("info"),

  // Add these properties to the app object at the top
  comparisonObject: null,
  comparisonModel: null,
  comparisonBoundingBox: null,

  // Initialize the application
  init() {
    this.setupThree();
    this.setupPhysics();
    this.setupLights();
    this.setupGround();
    this.loadBillTexture();
    // this.loadComparisonModels();
    this.setupEventListeners();

    // Render bills immediately after initialization
    this.renderBills();

    this.animate();

    // Initialize comparison features
    initComparisonFeatures();
  },

  // Set up Three.js scene, camera, renderer
  setupThree() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc6e4ff); // Light blue sky color

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      5000
    );
    this.camera.position.set(0, 10, 20);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = false; // Disable shadows
    document
      .getElementById("canvas-container")
      .appendChild(this.renderer.domElement);

    // Add orbit controls but disable rotation
    this.controls = new THREE.OrbitControls(
      this.camera,
      this.renderer.domElement
    );
    this.controls.enableRotate = this.ENABLE_NAVIGATION; // Enable/disable rotation based on flag
    this.controls.enablePan = this.ENABLE_NAVIGATION; // Enable/disable panning based on flag
    this.controls.enableZoom = true; // Allow zooming regardless of flag
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Restrict vertical rotation to prevent viewing from below
    this.controls.minPolarAngle = 0.1; // Slightly above horizontal to prevent glitchy behavior
    this.controls.maxPolarAngle = Math.PI / 2.1; // Slightly less than 90 degrees to prevent seeing below ground

    // Handle window resize
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Setup raycaster for interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.selectedBill = null;
    this.intersectedBill = null;
  },

  // Set up physics world
  setupPhysics() {
    // Create a world with gravity but we won't be adding bodies to it
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
  },

  // Set up lights
  setupLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Directional light (sun) - disable shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = false; // Disable shadow casting
    this.scene.add(directionalLight);
  },

  // Set up ground plane
  setupGround() {
    // Three.js ground - much larger (5000x5000 instead of 500x500)
    const groundGeometry = new THREE.PlaneGeometry(5000, 5000);

    // Load grass texture
    const textureLoader = new THREE.TextureLoader();
    const grassTexture = textureLoader.load(
      "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight-big.jpg",
      // Add onLoad callback
      () => {
        console.log("Grass texture loaded successfully");
      },
      // Add onProgress callback (optional)
      undefined,
      // Add onError callback
      (err) => {
        console.error("Error loading grass texture:", err);
      }
    );

    // Repeat the texture to make it look more realistic
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(300, 300); // More repeats for the much larger plane

    const groundMaterial = new THREE.MeshStandardMaterial({
      map: grassTexture,
      roughness: 0.8,
      metalness: 0.1,
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = false; // Disable shadow receiving
    this.scene.add(ground);

    // Cannon.js ground - updated for old Cannon.js syntax
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({
      mass: 0,
    });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(
      new CANNON.Vec3(1, 0, 0),
      -Math.PI / 2
    );
    this.world.addBody(groundBody);
  },

  // Load bill texture
  loadBillTexture() {
    const textureLoader = new THREE.TextureLoader();
    this.billTexture = textureLoader.load(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Usdollar100front.jpg/2560px-Usdollar100front.jpg",
      // Add onLoad callback to handle texture loading
      () => {
        console.log("Dollar Texture loaded successfully");
      },
      // Add onProgress callback (optional)
      undefined,
      // Add onError callback
      (err) => {
        console.error("Error loading texture:", err);
      }
    );

    // Create bill geometry (100 dollar bill dimensions: 156mm x 66.3mm x 0.11mm)
    // Using realistic dimensions
    const billWidth = 1.56;
    const billHeight = 0.663;
    const billThickness = 0.0011; // Realistische Dicke: 0.11mm = 0.0011 Einheiten

    const billGeometry = new THREE.BoxGeometry(
      billWidth,
      billThickness,
      billHeight
    );

    // Create materials for the bill
    const frontMaterial = new THREE.MeshStandardMaterial({
      map: this.billTexture,
      roughness: 0.5,
      metalness: 0.1,
    });
    const backMaterial = new THREE.MeshStandardMaterial({
      color: 0x85bb65,
      roughness: 0.5,
      metalness: 0.2,
    });
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.5,
      metalness: 0.1,
    });

    const materials = [
      edgeMaterial, // right side
      edgeMaterial, // left side
      frontMaterial, // top (front of bill)
      backMaterial, // bottom (back of bill)
      edgeMaterial, // front edge
      edgeMaterial, // back edge
    ];

    this.billMesh = new THREE.Mesh(billGeometry, materials);
    this.billMesh.castShadow = false; // Disable shadow casting
    this.billMesh.receiveShadow = false; // Disable shadow receiving
  },

  // Set up event listeners
  setupEventListeners() {
    // this.renderBtn.addEventListener("click", this.renderBills.bind(this));
    // this.amountSelect.addEventListener("change", this.renderBills.bind(this));

    // Use mousedown for bill selection
    this.renderer.domElement.addEventListener("mousedown", (event) => {
      if (event.button === 0) {
        // Left mouse button
        this.handleBillSelection(event);
      }
    });

    // Use mousemove for bill dragging
    this.renderer.domElement.addEventListener("mousemove", (event) => {
      if (this.selectedBill) {
        this.handleBillDragging(event);
      }
    });

    // Use mouseup to release bill
    this.renderer.domElement.addEventListener("mouseup", (event) => {
      if (event.button === 0) {
        // Left mouse button
        this.selectedBill = null;
      }
    });
  },

  handleBillSelection(event) {
    // Calculate mouse position
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.bills.map((bill) => bill.mesh)
    );

    if (intersects.length > 0) {
      // Find the bill that was clicked
      const selectedMesh = intersects[0].object;
      for (const bill of this.bills) {
        if (bill.mesh === selectedMesh || bill.mesh.id === selectedMesh.id) {
          this.selectedBill = bill;
          break;
        }
      }
    }
  },

  handleBillDragging(event) {
    // Calculate mouse position
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const planeIntersection = new THREE.Vector3();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.raycaster.ray.intersectPlane(dragPlane, planeIntersection);

    // Move the bill to follow the mouse
    this.selectedBill.body.position.x = planeIntersection.x;
    this.selectedBill.body.position.z = planeIntersection.z;
    this.selectedBill.body.position.y = Math.max(0.1, planeIntersection.y);
    this.selectedBill.body.velocity.set(0, 0, 0);
    this.selectedBill.body.angularVelocity.set(0, 0, 0);
    this.selectedBill.body.wakeUp();
  },

  // Render bills based on selected amount
  renderBills() {
    // Clear existing bills
    this.clearBills();

    // Get amount from the select element
    let amount = parseFloat(this.amountSelect.value);
    if (isNaN(amount)) amount = 0;

    // Round to nearest $100
    amount = Math.round(amount / 100) * 100;
    amount = Math.min(amount, 500000000000);

    // Calculate number of bills
    const numBills = amount / 100;

    // Format numbers with thousand separators
    const formattedNumBills = numBills.toLocaleString();
    const formattedAmount = amount.toLocaleString();
    // this.infoElement.textContent = `${formattedNumBills} x 100$ bill = $${formattedAmount}`;

    if (numBills <= 0) return;

    // For amounts under 100 million, use special edge texture
    const useEdgeTexture = amount < 100000000;

    // Check if we should use textures (disable for amounts >= 1 billion)
    // const useTextures = amount < 1000000000;

    // Determine if we should use detailed shadows based on number of stacks
    // For large amounts, disable shadows to improve performance
    const billsPerStack = 100;
    const numStacks = Math.ceil(numBills / billsPerStack);
    const useDetailedShadows = numStacks < 1000; // Only use detailed shadows for fewer than 1000 stacks

    if (!useDetailedShadows) {
      // console.log(
      //   "Large amount detected - using simplified shadows for better performance"
      // );
    }

    // Create shared geometry and materials for all stacks
    // This is a major optimization - we only create these once
    const billWidth = 1.56;
    const billHeight = 0.663;
    const billThickness = 0.0011;
    const stackHeight = billThickness * billsPerStack;

    // Create shared geometry
    this.sharedStackGeometry = new THREE.BoxGeometry(
      billWidth,
      stackHeight,
      billHeight
    );

    // Create edge texture if needed
    let edgeTexture = null;
    if (useEdgeTexture) {
      const edgeTextureCanvas = document.createElement("canvas");
      const ctx = edgeTextureCanvas.getContext("2d");
      edgeTextureCanvas.width = 128;
      edgeTextureCanvas.height = 16;

      // Fill with light beige color (paper color)
      ctx.fillStyle = "#f5f3e8";
      ctx.fillRect(0, 0, 128, 16);

      // Add thin black lines to represent bill edges
      ctx.fillStyle = "#000000";
      for (let i = 0; i < 16; i += 2) {
        ctx.fillRect(0, i, 128, 0.5);
      }

      edgeTexture = new THREE.CanvasTexture(edgeTextureCanvas);
      edgeTexture.wrapS = THREE.RepeatWrapping;
      edgeTexture.wrapT = THREE.RepeatWrapping;
      edgeTexture.repeat.set(10, 10);
    }

    // Create shared materials
    this.sharedTopMaterial = new THREE.MeshStandardMaterial({
      map: this.billTexture,
      roughness: 0.5,
      metalness: 0.1,
    });

    this.sharedSideMaterial = useEdgeTexture
      ? new THREE.MeshStandardMaterial({
          map: edgeTexture,
          roughness: 0.5,
          metalness: 0.1,
        })
      : new THREE.MeshStandardMaterial({
          color: 0xf5f3e8,
          roughness: 0.5,
          metalness: 0.1,
        });

    // Create shared materials array
    this.sharedMaterials = [
      this.sharedSideMaterial, // right side (index 0)
      this.sharedSideMaterial, // left side (index 1)
      this.sharedTopMaterial, // top face with texture (index 2)
      this.sharedSideMaterial, // bottom face (index 3)
      this.sharedSideMaterial, // front edge (index 4)
      this.sharedSideMaterial, // back edge (index 5)
    ];

    // Calculate optimal grid dimensions
    const totalVolume = numStacks * billWidth * billHeight * stackHeight;
    const targetWidth = Math.pow(totalVolume * 1.5, 1 / 3);

    // Calculate grid dimensions based on bill aspect ratio
    const aspectRatio = billWidth / billHeight;
    const targetRatio = Math.sqrt(aspectRatio);

    // Calculate grid dimensions (columns and rows)
    const maxGridX = 75;
    const maxGridZ = 150;
    let gridX = Math.min(
      Math.ceil(Math.sqrt(numStacks / targetRatio)),
      maxGridX
    );
    let gridZ = Math.min(Math.ceil(numStacks / gridX), maxGridZ);

    // Calculate how many layers we need to achieve the target height
    const targetHeight = (targetWidth * 2) / 3;
    const layersNeeded = Math.ceil(targetHeight / stackHeight);

    // Recalculate grid dimensions with layers
    if (layersNeeded > 1) {
      const stacksPerLayer = Math.ceil(numStacks / layersNeeded);
      gridX = Math.min(
        Math.ceil(Math.sqrt(stacksPerLayer / targetRatio)),
        maxGridX
      );
      gridZ = Math.min(Math.ceil(stacksPerLayer / gridX), maxGridZ);
    }

    // Base spacing on bill dimensions
    const spacingX = billWidth * 1.15; // Horizontal spacing with small gap
    const spacingZ = billHeight * 1.15; // Vertical spacing proportional to bill height

    // Calculate stacks per layer
    const stacksPerLayer = gridX * gridZ;
    const numLayers = Math.ceil(numStacks / stacksPerLayer);

    // Create a map to store bills at each grid position
    const gridPositions = new Map();

    // Calculate how many complete layers we can fill
    const billsPerCompleteLayer = stacksPerLayer * billsPerStack;
    const completeLayersCount = Math.floor(numBills / billsPerCompleteLayer);
    let remainingBills = numBills - completeLayersCount * billsPerCompleteLayer;

    // First, fill all complete layers (we can do this mathematically without loops)
    for (let row = 0; row < gridZ; row++) {
      for (let col = 0; col < gridX; col++) {
        // Calculate position
        const offsetX = (col - (gridX - 1) / 2) * spacingX;
        const offsetZ = (row - (gridZ - 1) / 2) * spacingZ;
        const posKey = `${row},${col}`;

        // Each position gets completeLayersCount * billsPerStack bills
        gridPositions.set(posKey, {
          x: offsetX,
          y: 0,
          z: offsetZ,
          bills: completeLayersCount * billsPerStack,
        });
      }
    }

    // Now distribute remaining bills for the partial layer (if any)
    if (remainingBills > 0) {
      for (let row = 0; row < gridZ && remainingBills > 0; row++) {
        for (let col = 0; col < gridX && remainingBills > 0; col++) {
          const posKey = `${row},${col}`;
          const stackBills = Math.min(billsPerStack, remainingBills);
          remainingBills -= stackBills;

          // Add to existing position
          gridPositions.get(posKey).bills += stackBills;
        }
      }
    }

    // Create stacks for each grid position
    let stacksCreated = 0;

    // Calculate the bounds of the stacks
    let minX = Infinity,
      maxX = -Infinity;
    let minZ = Infinity,
      maxZ = -Infinity;
    let maxY = 0;

    for (const [_, position] of gridPositions) {
      minX = Math.min(minX, position.x - billWidth / 2);
      maxX = Math.max(maxX, position.x + billWidth / 2);
      minZ = Math.min(minZ, position.z - billHeight / 2);
      maxZ = Math.max(maxZ, position.z + billHeight / 2);

      // Calculate stack height
      const stackHeight = position.bills * billThickness;
      maxY = Math.max(maxY, stackHeight);

      this.createVisualStack(
        position.x,
        position.y,
        position.z,
        position.bills
        // useTextures
      );
      stacksCreated++;
    }

    // Update info with stack count
    // this.infoElement.textContent = `${formattedNumBills} x 100$ = $${formattedAmount}`;

    // Adjust camera to fit all stacks and comparison object
    this.adjustCameraToFitScene();
  },

  // New method to adjust camera position to fit all stacks with 10% margin
  adjustCameraToFitStacks(minX, maxX, minZ, maxZ, maxY) {
    // If there are no stacks, return to default position
    if (minX === Infinity || maxX === -Infinity) {
      this.camera.position.set(0, 10, 20);
      this.camera.lookAt(0, 0, 0);
      this.controls.target.set(0, 0, 0);
      return;
    }

    // Calculate the center of the stacks
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const centerY = maxY / 2;

    // Set the camera target to the center of the stacks
    this.controls.target.set(centerX, centerY, centerZ);

    // Calculate the size of the stacks
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const height = maxY;

    // Calculate the distance needed to fit the stacks in the view with margin
    const fov = this.camera.fov * (Math.PI / 180);
    const aspectRatio = this.camera.aspect;

    // Apply a larger margin factor to zoom out further
    const marginFactor = 1.8;

    // Calculate distances needed for each dimension
    const fitHeightDistance = (height * marginFactor) / (2 * Math.tan(fov / 2));
    const fitWidthDistance =
      (width * marginFactor) / (2 * Math.tan(fov / 2) * aspectRatio);
    const fitDepthDistance = (depth * marginFactor) / (2 * Math.tan(fov / 2));

    // Use the maximum distance to ensure everything fits
    const distance = Math.max(
      fitHeightDistance,
      fitWidthDistance,
      fitDepthDistance
    );

    // Position the camera at a different angle (from lower left)
    // Changed from 45 degrees to about 135 degrees (Math.PI * 3/4)
    const cameraAngle = (Math.PI * 3) / 4; // 135 degrees

    // Calculate camera position
    const cameraX = centerX - Math.sin(cameraAngle) * distance;
    const cameraZ = centerZ - Math.cos(cameraAngle) * distance;

    // Position camera slightly above the center for a better view
    const cameraY = centerY + distance * 0.5;

    // Set the camera position
    this.camera.position.set(cameraX, cameraY, cameraZ);

    // Update the controls
    this.controls.update();

    // Log camera positioning for debugging
    // console.log(
    //   `Camera positioned at (${cameraX.toFixed(2)}, ${cameraY.toFixed(
    //     2
    //   )}, ${cameraZ.toFixed(2)})`
    // );
    // console.log(
    //   `Target: (${centerX.toFixed(2)}, ${centerY.toFixed(2)}, ${centerZ.toFixed(
    //     2
    //   )})`
    // );
    // console.log(
    //   `Stack dimensions: ${width.toFixed(2)} x ${height.toFixed(
    //     2
    //   )} x ${depth.toFixed(2)}`
    // );
    // console.log(
    //   `Distance: ${distance.toFixed(2)}, Margin factor: ${marginFactor}`
    // );
  },

  // Create a visual stack of bills without physics - optimized version
  createVisualStack(x, y, z, numBills) {
    const billWidth = 1.56;
    const billHeight = 0.663;
    const billThickness = 0.0011;

    // Calculate stack height
    const stackHeight = billThickness * numBills;

    // Use the shared geometry and materials created in renderBills
    // This is much more efficient than creating new ones for each stack
    const stackMesh = new THREE.Mesh(
      this.sharedStackGeometry,
      this.sharedMaterials
    );

    // Scale the mesh to match the actual stack height
    // This allows us to use the same geometry for stacks of different heights
    const standardStackHeight = billThickness * 100; // Height for 100 bills
    const scaleY = stackHeight / standardStackHeight;
    stackMesh.scale.y = scaleY;

    // Disable shadows for all stacks
    stackMesh.castShadow = false;
    stackMesh.receiveShadow = false;

    // Position the mesh directly in the scene (no group)
    stackMesh.position.set(
      x,
      y + stackHeight / 2, // Position the stack so its bottom is at y
      z
    );
    this.scene.add(stackMesh);

    // Store reference to the stack mesh directly
    this.bills.push({
      mesh: stackMesh,
      billCount: numBills,
      isVisualStack: true,
    });
  },

  // Clear all bills
  clearBills() {
    for (const bill of this.bills) {
      this.scene.remove(bill.mesh);
      // Only remove physics bodies if they exist
      if (bill.body) {
        this.world.removeBody(bill.body);
      }
    }
    this.bills = [];
  },

  // Animation loop - simplified without physics
  animate() {
    requestAnimationFrame(this.animate.bind(this));

    // No physics updates needed

    // Update controls
    this.controls.update();

    // Render scene
    this.renderer.render(this.scene, this.camera);
  },

  // New method for instanced rendering of very large amounts
  createInstancedBillStacks(numBills) {
    const billWidth = 1.56;
    const billHeight = 0.663;
    const billThickness = 0.0011;

    // Each stack represents $10,000 (100 bills)
    const billsPerStack = 100;
    const numStacks = Math.ceil(numBills / billsPerStack);

    // Calculate grid dimensions
    const gridSize = Math.ceil(Math.sqrt(numStacks));
    const spacing = Math.max(billWidth, billHeight) * 1.2;

    // Create instanced mesh for stacks
    const stackGeometry = new THREE.BoxGeometry(
      billWidth,
      billThickness * billsPerStack,
      billHeight
    );

    // Simple material for all instances
    const stackMaterial = [
      new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.5,
        metalness: 0.1,
      }), // right
      new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.5,
        metalness: 0.1,
      }), // left
      new THREE.MeshStandardMaterial({
        map: this.billTexture,
        roughness: 0.5,
        metalness: 0.1,
      }), // top
      new THREE.MeshStandardMaterial({
        color: 0x85bb65,
        roughness: 0.5,
        metalness: 0.2,
      }), // bottom
      new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.5,
        metalness: 0.1,
      }), // front
      new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.5,
        metalness: 0.1,
      }), // back
    ];

    const instancedMesh = new THREE.InstancedMesh(
      stackGeometry,
      stackMaterial,
      numStacks
    );

    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    this.scene.add(instancedMesh);

    // Create matrix for each instance
    const matrix = new THREE.Matrix4();
    const stackHeight = billThickness * billsPerStack;

    for (let i = 0; i < numStacks; i++) {
      const row = Math.floor(i / gridSize);
      const col = i % gridSize;

      const x = (col - gridSize / 2) * spacing;
      const z = (row - gridSize / 2) * spacing;
      const y = stackHeight / 2;

      matrix.setPosition(x, y, z);
      instancedMesh.setMatrixAt(i, matrix);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;

    // Store reference
    this.bills.push({
      mesh: instancedMesh,
      billCount: numBills,
      isVisualStack: true,
      isInstanced: true,
    });

    // Update info
    const formattedNumBills = numBills.toLocaleString();
    const formattedAmount = (numBills * 100).toLocaleString();
    // this.infoElement.textContent = `${formattedNumBills} x 100$ bill = $${formattedAmount} (${numStacks.toLocaleString()} stacks using instanced rendering)`;
  },

  // Load comparison models
  loadComparisonModels() {
    const loader = new THREE.GLTFLoader();

    // Try a simpler model from the official Khronos sample models
    loader.load(
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf",
      (gltf) => {
        const model = gltf.scene;

        // Scale the model appropriately (make it larger for visibility)
        model.scale.set(5, 5, 5);

        // Position the model next to the money stacks
        model.position.set(5, 0, 0);

        // Add to scene
        this.scene.add(model);

        console.log("Comparison model loaded successfully");
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
      },
      (error) => {
        console.error("Error loading comparison model:", error);

        // If all else fails, create a simple cube as reference
        this.createSimpleReferenceObject();
      }
    );
  },

  // Create a simple reference object if all models fail
  createSimpleReferenceObject() {
    // Create a 1 meter cube as reference
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x3366ff });
    const cube = new THREE.Mesh(geometry, material);

    // Position it next to the money
    cube.position.set(5, 0.5, 0);

    // Add text label "1 meter cube"
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = 256;
    canvas.height = 128;
    context.fillStyle = "white";
    context.font = "24px Arial";
    context.fillText("1 meter cube", 60, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const labelGeometry = new THREE.PlaneGeometry(2, 1);
    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    label.position.set(5, 1.5, 0);
    label.rotation.y = Math.PI / 4;

    this.scene.add(cube);
    this.scene.add(label);

    console.log("Created simple reference object");
  },

  // Add a new method to directly visualize an amount
  visualize(amount) {
    // Validate and process the amount
    amount = parseFloat(amount);
    if (isNaN(amount)) amount = 0;

    // Round to nearest $100
    amount = Math.round(amount / 100) * 100;
    amount = Math.min(amount, 500000000000);

    // Store the amount in the amountSelect for compatibility
    if (this.amountSelect) {
      this.amountSelect.value = amount;
    } else {
      // Create a temporary select element if it doesn't exist
      this.amountSelect = { value: amount };
    }

    // Call the existing renderBills method
    // this.renderBills();
  },

  // Add this method to load and position comparison objects
  loadComparisonObject(objectId) {
    // Remove any existing comparison object
    if (this.comparisonModel) {
      this.scene.remove(this.comparisonModel);
      this.comparisonModel = null;
      this.comparisonBoundingBox = null;
      this.comparisonObject = null;
    }

    // If "none" is selected, just return
    if (!objectId || objectId === "none") {
      // Adjust camera to focus only on bills
      this.adjustCameraToFitScene();
      return;
    }

    // Find the selected comparison object
    const selectedObject = comparisonObjects.find((obj) => obj.id === objectId);
    if (!selectedObject || !selectedObject.modelPath) {
      console.error("Invalid comparison object or missing model path");
      return;
    }

    this.comparisonObject = selectedObject;

    // Load the 3D model
    const loader = new THREE.GLTFLoader();
    loader.load(
      selectedObject.modelPath,
      (gltf) => {
        const model = gltf.scene;

        // Calculate the bounding box of the model
        const boundingBox = new THREE.Box3().setFromObject(model);
        const modelSize = new THREE.Vector3();
        boundingBox.getSize(modelSize);

        // Scale the model to match the specified height
        const scale = (selectedObject.height * 10) / modelSize.y;
        model.scale.set(scale, scale, scale);

        // Recalculate bounding box after scaling
        const scaledBoundingBox = new THREE.Box3().setFromObject(model);
        this.comparisonBoundingBox = scaledBoundingBox;

        // Position the model next to the money stacks
        this.positionComparisonModel(model);

        // Add to scene
        this.comparisonModel = model;
        this.scene.add(model);

        // Adjust camera to fit both objects
        this.adjustCameraToFitScene();

        console.log(`Loaded comparison object: ${selectedObject.title}`);
      },
      (xhr) => {
        console.log(
          `${selectedObject.title} model: ${
            (xhr.loaded / xhr.total) * 100
          }% loaded`
        );
      },
      (error) => {
        console.error(`Error loading ${selectedObject.title} model:`, error);
        // Create a simple placeholder if model fails to load
        this.createSimpleComparisonObject(selectedObject);
      }
    );
  },

  // Create a simple placeholder for comparison objects
  createSimpleComparisonObject(objectData) {
    // Get the height in meters (already in correct scale)
    const height = objectData.height * 10;
    const width = objectData.width * 10;
    const depth = objectData.depth * 10; // Square base for simplicity

    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
      color: 0x3366ff,
      transparent: true,
      opacity: 0.7,
    });

    const model = new THREE.Mesh(geometry, material);

    // Position the box at half its height (so bottom is at y=0)
    model.position.y = height / 2;

    // Calculate bounding box
    const boundingBox = new THREE.Box3().setFromObject(model);
    this.comparisonBoundingBox = boundingBox;

    // Position the model next to the money stacks
    this.positionComparisonModel(model);

    // Add text label with the object name and actual height
    // const canvas = document.createElement("canvas");
    // const context = canvas.getContext("2d");
    // canvas.width = 512;
    // canvas.height = 128;
    // context.fillStyle = "white";
    // context.font = "bold 36px Arial";
    // context.fillText(objectData.title, 10, 64);
    // context.font = "24px Arial";
    // context.fillText(`Height: ${height}m`, 10, 100);

    // const texture = new THREE.CanvasTexture(canvas);
    // const labelMaterial = new THREE.MeshBasicMaterial({
    //   map: texture,
    //   transparent: true,
    //   side: THREE.DoubleSide,
    // });

    // const labelGeometry = new THREE.PlaneGeometry(width * 2, width * 0.5);
    // const label = new THREE.Mesh(labelGeometry, labelMaterial);
    // label.position.set(0, height + 0.2, 0); // Position label just above the object
    // label.rotation.x = -Math.PI / 4;

    // model.add(label);

    // Add to scene
    this.comparisonModel = model;
    this.scene.add(model);

    // Adjust camera to fit both objects
    this.adjustCameraToFitScene();

    console.log(
      `Created simple placeholder for: ${objectData.title} with height: ${height}m`
    );
  },

  // Position the comparison model next to the money stacks
  positionComparisonModel(model) {
    // First, calculate the bounding box of all bills
    let billsBoundingBox = null;

    if (this.bills.length > 0) {
      billsBoundingBox = new THREE.Box3();

      for (const bill of this.bills) {
        const billBox = new THREE.Box3().setFromObject(bill.mesh);
        billsBoundingBox.union(billBox);
      }
    } else {
      // If no bills, place at origin
      model.position.set(5, 0, 0);
      return;
    }

    // Calculate the size of the bills area
    const billsSize = new THREE.Vector3();
    billsBoundingBox.getSize(billsSize);

    // Calculate the size of the comparison model
    const modelBox = new THREE.Box3().setFromObject(model);
    const modelSize = new THREE.Vector3();
    modelBox.getSize(modelSize);

    // Position the model to the right of the bills with some spacing
    const spacing = Math.max(billsSize.x, modelSize.x) * 0.2; // 20% of the larger width as spacing

    // Get the center of the bills
    const billsCenter = new THREE.Vector3();
    billsBoundingBox.getCenter(billsCenter);

    // Position the model to the right of the bills
    model.position.x = billsBoundingBox.max.x + spacing + modelSize.x / 2;
    model.position.z = billsCenter.z;
    // Y position is already set based on the model's origin
  },

  // Update the adjustCameraToFitStacks method to include comparison objects
  adjustCameraToFitScene() {
    // Calculate combined bounding box of bills and comparison object
    let combinedBox = new THREE.Box3();

    // Add bills to bounding box
    let hasBills = false;
    for (const bill of this.bills) {
      const billBox = new THREE.Box3().setFromObject(bill.mesh);
      combinedBox.union(billBox);
      hasBills = true;
    }

    // Add comparison object to bounding box if it exists
    if (this.comparisonModel) {
      const comparisonBox = new THREE.Box3().setFromObject(
        this.comparisonModel
      );
      combinedBox.union(comparisonBox);
    }

    // If nothing to show, return to default position
    if (!hasBills && !this.comparisonModel) {
      this.camera.position.set(0, 10, 20);
      this.camera.lookAt(0, 0, 0);
      this.controls.target.set(0, 0, 0);
      return;
    }

    // Calculate the center of the combined objects
    const center = new THREE.Vector3();
    combinedBox.getCenter(center);

    // Set the camera target to the center
    this.controls.target.set(center.x, center.y, center.z);

    // Calculate the size of the combined objects
    const size = new THREE.Vector3();
    combinedBox.getSize(size);

    // Calculate the distance needed to fit everything in the view with margin
    const fov = this.camera.fov * (Math.PI / 180);
    const aspectRatio = this.camera.aspect;

    // Apply a larger margin factor to zoom out further
    const marginFactor = 1.8;

    // Calculate distances needed for each dimension
    const fitHeightDistance = (size.y * marginFactor) / (2 * Math.tan(fov / 2));
    const fitWidthDistance =
      (size.x * marginFactor) / (2 * Math.tan(fov / 2) * aspectRatio);
    const fitDepthDistance = (size.z * marginFactor) / (2 * Math.tan(fov / 2));

    // Use the maximum distance to ensure everything fits
    const distance = Math.max(
      fitHeightDistance,
      fitWidthDistance,
      fitDepthDistance
    );

    // Position the camera at a different angle (from lower left)
    const cameraAngle = (Math.PI * 3) / 4; // 135 degrees

    // Calculate camera position
    const cameraX = center.x - Math.sin(cameraAngle) * distance;
    const cameraZ = center.z - Math.cos(cameraAngle) * distance;

    // Position camera slightly above the center for a better view
    const cameraY = center.y + distance * 0.5;

    // Set the camera position
    this.camera.position.set(cameraX, cameraY, cameraZ);

    // Update the controls
    this.controls.update();
  },
};

// Initialize when the page loads
window.addEventListener("load", () => {
  app.init();
});
