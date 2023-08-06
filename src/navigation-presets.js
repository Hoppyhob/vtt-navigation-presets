export const modName = 'Navigation Presets';
const modId = 'navigation-presets';
const mainSettingKey = 'npresets';
const activePresetKey = 'active-preset';
const currentNavIdsKey = 'current-navids';
const playerEnabledKey = 'player-enabled';
const truncateNameKey = 'truncate-name';
const dataPresetId = 'data-npreset-id';
const defaultPreset = 'default';

function logger(message, data) {
  console.log(`${modName} | ${message}`, data);
}

function isEventRightClick(ev) {
  if ('which' in ev)
    return ev.which === 3;
  else if ('button' in ev)
    return ev.button === 2;
  return false;
}

function generateRandomPresetName() {
  return Math.random().toString(36).replace('0.', 'npreset_' || '');
}

Handlebars.registerHelper('ifInPreset', function(presetId, scenes, options) {
  if (scenes != null && scenes.includes(presetId)) {
    return options.fn(this);
  }
  return options.inverse(this);
});

function getNavScenes() {
  return document.querySelectorAll('li.nav-item.scene');
}

function getSceneId(node) {
  return node.getAttribute('data-scene-id');
}

function getVisibleNavIds() {
  let sceneIds = [];
  for (let nav of getNavScenes()) {
    sceneIds.push(getSceneId(nav));
  }
  logger('getVisibleNavIds found the following scenes', sceneIds);
  return sceneIds;
}

function alphaSortScenes(scenes) {
  scenes.sort(function(a, b) {
    if (a.name < b.name)
      return -1;
    else if (a.name > b.name)
      return 1;
    return 0;
  });

  return scenes;
}

function alphaSortPresets(presets) {
  let sorted = Object.values(presets).sort(function(a, b) {
    if (a.titleText < b.titleText)
      return -1;
    else if (a.titleText > b.titleText)
      return 1;
    return 0;
  });

  return sorted;
}

function generatePlayerIcons(preset) {
  let playerIconList = [];
  for (let scene of getNavScenes()) {
    if (preset.sceneList.includes(getSceneId(scene))) {
      let players = scene.querySelectorAll('.scene-players > .scene-player')
      if (players != null) {
        for (let player of players) {
          let newPlayer = player.cloneNode();
          newPlayer.innerText = player.innerText;
          playerIconList.push(newPlayer);
        }
      }
    }
  }

  return playerIconList;
}

function presetHasActiveScene(preset) {
  for (let scene of getNavScenes()) {
    if (preset.sceneList.includes(getSceneId(scene))) {
      if (scene.querySelector('i.fa-bullseye') != null) {
        return true;
      }
    }
  }
  return false;
}

export class NavigationPreset {
  constructor(title, color) {
    this.title = title;
    this.color = color;
    this.scenes = [];
    this.uid = generateRandomPresetName();
    this.active = false;
  }
  initFromExisting(existing) {
    this.title = existing['titleText'];
    this.color = existing['colorText']
    this.scenes = existing['sceneList'];
    this.uid = existing['_id'];
    this.active = existing['isActive'];
  }
  get uid() {return this._id;}
  set uid(id) {this._id = id;}
  get title() {return this.titleText;}
  get color() {return this.colorText;}
  set title(ntitle) {this.titleText = ntitle;}
  set color(ncolor) {this.colorText = ncolor;}
  get scenes() {return this.sceneList;}
  set scenes(scenes) {this.sceneList = scenes;}
  get active() {return this.isActive};
  set active(a) {this.isActive = a;}
}

async function initPresets() {
  let allPresets = Settings.getPresets();
  let sceneIds = getVisibleNavIds();
  allPresets[defaultPreset] = {
    'sceneList': sceneIds,
    'titleText': 'Default',
    '_id': defaultPreset,
    'colorText': '#000000',
    'isActive': true
  };

  if (game.ready) {
    logger('initPresets() called after game is ready', {
      allPresets,
      sceneIds,
    });
    await game.settings.set(modId, mainSettingKey, allPresets);
  } else {
    Hooks.once('ready', async function() {
      logger('initPresets() called after Hooks.once.ready', {
        allPresets,
        sceneIds,
      });
      await game.settings.set(modId, mainSettingKey, allPresets);
    });
  }
}

function clearExistingElements() {
  logger('clearing existing elements');
  let createButton = document.querySelector('a.create-preset');
  let navMenu = document.querySelector('nav#navpresets-menu');
  let activePreset = document.querySelector('a.scene-presets');
  if (createButton != null) {
    logger('clearing create button');
    createButton.parentElement.removeChild(createButton);
  }
  if (navMenu != null) {
    logger('clearing nav menu', {navScenes: getNavScenes()});
    navMenu.parentElement.removeChild(navMenu);
  }
  if (activePreset != null) {
    logger('clearing active preset');
    activePreset.parentElement.removeChild(activePreset);
  }
}

async function assignNewNavItemsToDefault(existingNavItems) {
  let allPresets = Settings.getPresets();
  let assigned = [];
  let unassigned = [];
  for (let preset of Object.values(allPresets)) {
    assigned = assigned.concat(preset.sceneList);
  }
  for (let navItem of existingNavItems) {
    if (!assigned.includes(getSceneId(navItem))) {
      unassigned.push(getSceneId(navItem));
    }
  }
  allPresets[defaultPreset].sceneList = allPresets[defaultPreset].sceneList.concat(unassigned);
  if (game.ready)
    await game.settings.set(modId, mainSettingKey, allPresets);
  else
    Hooks.once('ready',async function() {
      await game.settings.set(modId, mainSettingKey, allPresets);
    });
}

async function filterNavItemsToActivePreset(activePreset) {
  let existingNavItems = getNavScenes();
  if (game.user.isGM)
    await assignNewNavItemsToDefault(existingNavItems);
  for (let navItem of existingNavItems) {
    if (!activePreset.sceneList.includes(getSceneId(navItem))) {
      navItem.style.display = 'none';
    }else{
      navItem.style.display = '';
    }
  }
}

function setupPresets() {
  logger('setting up presets');
  Settings.checkActivePresetExists();
  let allPresets = Settings.getPresets();
  let activePreset = allPresets[Settings.getActivePresetId()];
  clearExistingElements();
  let navbar = document.querySelector('ol#scene-list');

  // visible preset
  let dropdown = document.createElement('a');
  dropdown.classList.add('scene-presets');
  let caretIcon = document.createElement('i');
  caretIcon.classList.add('fas', 'fa-caret-right');
  dropdown.innerHTML = caretIcon.outerHTML + activePreset.titleText;
  dropdown.style.backgroundColor = activePreset.colorText
  dropdown.setAttribute(dataPresetId, activePreset._id);

  // other presets
  let contextItems = document.createElement('ol');
  contextItems.classList.add('context-items', 'flexrow');
  let presetMenu = document.createElement('nav');
  presetMenu.classList.add('expand-down');
  presetMenu.id = 'navpresets-menu';
  for (let preset of alphaSortPresets(allPresets)) {
    if (preset._id === defaultPreset && preset.sceneList?.length === 0) continue;
    if (preset._id !== activePreset._id) {
      let li = document.createElement('li');
      li.classList.add('nav-preset');
      if (presetHasActiveScene(preset)) {
        let bullseye = document.createElement('i');
        bullseye.classList.add('fas', 'fa-bullseye');
        li.innerHTML = bullseye.outerHTML+preset.titleText;
      } else {
        li.innerHTML = preset.titleText;
      }
      li.style.backgroundColor = preset.colorText;
      li.setAttribute(dataPresetId, preset._id);

      // player icons
      let playerIcons = generatePlayerIcons(preset);
      if (playerIcons.length > 0) {
        let playerList = document.createElement('ul');
        playerList.classList.add('scene-players');
        for (let player of playerIcons) {
          playerList.appendChild(player);
        }
        li.appendChild(playerList);
      }
      contextItems.appendChild(li);
    }
  }
  presetMenu.appendChild(contextItems);
  presetMenu.style.display = 'none';

  navbar.insertAdjacentElement('afterbegin', dropdown);
  navbar.insertAdjacentElement('afterbegin', presetMenu);

  // create button
  if (game.user.isGM) {
    let createButton = document.createElement('a');
    createButton.classList.add('create-preset');
    createButton.title = 'Create Preset';
    createButton.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    let createIcon = document.createElement('i');
    createIcon.classList.add('fas', 'fa-plus');

    createButton.innerHTML = createIcon.outerHTML;
    navbar.insertAdjacentElement('afterbegin', createButton);
    createButton.addEventListener('click', function() {
      let newFolder = new NavigationPreset('New Preset', '');
      new NavigationPresetEditConfig(newFolder).render(true);
    })
  }

  filterNavItemsToActivePreset(activePreset);
}

function createContextMenu(parent) {
  if (document.querySelector('nav#preset-context-menu') != null) {
    closeContextMenu();
  }
  let presetContextMenu = document.createElement('nav');
  presetContextMenu.classList.add('expand-down');
  presetContextMenu.id = 'preset-context-menu';
  if (parent.classList.contains('nav-preset')) {
    presetContextMenu.style.marginLeft = parent.offsetLeft + 'px';
  }
  let presetContextMenuList = document.createElement('ol');
  presetContextMenuList.classList.add('context-items');

  let presetEditOption = document.createElement('li');
  presetEditOption.classList.add('context-item');
  let editIcon = document.createElement('i');
  editIcon.classList.add('fas', 'fa-cog');
  presetEditOption.innerHTML = editIcon.outerHTML + 'Edit';

  presetContextMenuList.appendChild(presetEditOption);

  if (parent.getAttribute(dataPresetId) !== defaultPreset) {
    let presetDeleteOption = document.createElement('li');
    presetDeleteOption.classList.add('context-item');
    let deleteIcon = document.createElement('i');
    deleteIcon.classList.add('fas', 'fa-trash');
    presetDeleteOption.innerHTML = deleteIcon.outerHTML + 'Delete';
    presetDeleteOption.addEventListener('click', function(ev) {
      ev.stopPropagation();
      closeContextMenu();
      let preset = Settings.getPresets()[parent.getAttribute(dataPresetId)];
      new Dialog({
        title: 'Delete Preset',
        content: '<p>Are you sure you want to delete the preset <strong>' + preset.titleText + '?</strong></p>'
          + '<p><i>Navigation items in these presets will be moved to the Default preset</i></p>',
        buttons: {
          yes: {
            icon: '<i class="fas fa-check"></i>',
            label: 'Yes',
            callback: () => deletePreset(preset._id)
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: 'No'
          }
        }
      }).render(true);
    });
    presetContextMenuList.appendChild(presetDeleteOption);
  }

  presetContextMenu.appendChild(presetContextMenuList);

  document.addEventListener('click', function(ev) {
    ev.stopPropagation();
    if (ev.target != parent) {
      closeContextMenu();
    }
  });

  presetEditOption.addEventListener('click', function(ev) {
    ev.stopPropagation()
    let newFolder = new NavigationPreset('Default', '');
    let preset = Settings.getPresets()[parent.getAttribute(dataPresetId)];
    newFolder.initFromExisting(preset);
    new NavigationPresetEditConfig(newFolder).render(true);
    closeContextMenu();
  })

  parent.insertAdjacentElement('afterBegin', presetContextMenu);
}

function closeContextMenu() {
  let contextMenu = document.querySelector('nav#preset-context-menu');
  if (contextMenu != null)
    contextMenu.parentNode.removeChild(contextMenu);
}

function addEventListeners() {
  let dropdown = document.querySelector('a.scene-presets');
  dropdown.addEventListener('click', function(ev) {
    ev.stopPropagation();
    let menu = document.querySelector('#navpresets-menu');
    if (menu.style.display === 'none') {
      let caretIcon = dropdown.querySelector('i.fa-caret-right');
      caretIcon.classList.add('fa-caret-down');
      caretIcon.classList.remove('fa-caret-right');
      menu.style.display = '';
    } else {
      let caretIcon = dropdown.querySelector('i.fa-caret-down');
      caretIcon.classList.add('fa-caret-right');
      caretIcon.classList.remove('fa-caret-down');
      menu.style.display='none';
    }
  });

  if (game.user.isGM) {
    dropdown.addEventListener('contextmenu', function(ev) {
      ev.stopPropagation();
      ev.preventDefault();
      createContextMenu(dropdown);
    });
  }

  let otherPresets = document.querySelectorAll('li.nav-preset');
  for (let preset of otherPresets) {
    preset.addEventListener('click', async function(ev) {
      ev.stopPropagation();
      if (!isEventRightClick(ev)) {
        await Settings.activatePreset(preset.getAttribute(dataPresetId));
        refreshPresets();
      }
    });
    if (game.user.isGM) {
      preset.addEventListener('contextmenu', function(ev) {
        ev.stopPropagation();
        ev.preventDefault();
        createContextMenu(preset);
      });
    }
  }
}

class NavigationPresetEditConfig extends FormApplication {
  static get defaultOptions() {
    const options = super.defaultOptions;
    options.id = 'navigation-preset-edit';
    options.template = `modules/${modId}/templates/navigation-preset-edit.html`;
    options.width = 500;
    return options;
  }

  get title() {
    if (this.object.colorText.length > 1) {
      return `Update Preset: ${this.object.titleText}`;
    }
    return 'Create Preset';
  }

  getGroupedPacks() {
    let allPresets = game.settings.get(modId, mainSettingKey);
    let assigned = {};
    let unassigned = {};

    let visibleNavIcons = getVisibleNavIds();
    Object.keys(allPresets).forEach(function(key) {
      if (key !== defaultPreset) {
        for (let a of allPresets[key].sceneList) {
          if (visibleNavIcons.includes(a)) {
            assigned[a] = game.scenes.get(a);
          }
        }
      }
    });
    for (let scene of visibleNavIcons) {
      if (!Object.keys(assigned).includes(scene)) {
        unassigned[scene] = game.scenes.get(scene);
      }
    }
    logger('getGroupedPacks found these scenes', {
      assigned,
      unassigned
    });
    return {assigned, unassigned};
  }

  /** @override */
  async getData(options) {
    let allScenes = this.getGroupedPacks();
    return {
      preset: this.object,
      defaultFolder: this.object._id === defaultPreset,
      ascenes: alphaSortScenes(Object.values(allScenes.assigned)),
      uscenes: alphaSortScenes(Object.values(allScenes.ungetassigned)),
      submitText: this.object.colorText.length > 1 ? 'Update Preset' : 'Create Preset',
      deleteText: (this.object.colorText.length > 1 && this.object._id !== defaultPreset) ? 'Delete Preset' : null
    };
  }

  /** @override */
  async _updateObject(event, formData) {
    this.object.titleText = formData.name;
    if (formData.color.length === 0) {
      this.object.colorText = '#000000';
    } else {
      this.object.colorText = formData.color;
    }

    // update scene assignment
    let scenesToAdd = [];
    let scenesToRemove = [];
    for (let sceneKey of game.scenes.keys()) {
      if (formData[sceneKey] && !this.object.sceneList.includes(sceneKey)) {
        // box ticked AND scene not in folder
        scenesToAdd.push(sceneKey);
      } else if (!formData[sceneKey] && this.object.sceneList.includes(sceneKey)) {
        // box unticked AND scene in folder
        scenesToRemove.push(sceneKey);
      }
    }
    if (formData.delete != null && formData.delete[0] === 1) {
      // do delete stuff
      new Dialog({
        title: 'Delete Preset',
        content: '<p>Are you sure you want to delete the preset <strong>' + this.object.titleText + '?</strong></p>'
          + '<p><i>Navigation items in these presets will be moved to the Default preset</i></p>',
        buttons: {
          yes: {
            icon: '<i class="fas fa-check"></i>',
            label: 'Yes',
            callback: () => deletePreset(this.object._id)
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: 'No'
          }
        }
      }).render(true);
    } else {
      await updatePresets(scenesToAdd, scenesToRemove, this.object);
    }
  }
}

function refreshPresets() {
  setupPresets();
  addEventListeners();
}

async function updatePresets(scenesToAdd, scenesToRemove, preset) {
  let presetId = preset._id;
  let allPresets = Settings.getPresets();
  if (allPresets[presetId] == null) {
    allPresets[presetId] = preset;
  }
  let scenesMoved = [];
  for (let sceneKey of scenesToAdd) {
    Object.keys(allPresets).forEach(function(sId) {
      if (allPresets[sId].sceneList.includes(sceneKey)) {
        allPresets[sId].sceneList.splice(allPresets[sId].sceneList.indexOf(sceneKey), 1);
        logger(`removing ${sceneKey} from preset ${allPresets[sId].titleText}`);
        if (sId !== 'hidden') {
          scenesMoved.push(sceneKey);
        }
      }
    });

    allPresets[presetId].sceneList.push(sceneKey);
    logger(`adding ${sceneKey} to preset ${preset.titleText}`);
  }
  if (scenesMoved.length > 0) {
    let message = scenesMoved.length <= 1 ? 'Removing 1 scene from another preset' : `Removing ${scenesMoved.length} scenes from other presets`;
    ui.notifications.notify(message);
  }
  if (scenesToRemove.length>0) {
    let messagePrefix = scenesToRemove.length <= 1 ? 'Adding 1 scene' : `Adding ${scenesMoved.length} scenes`;
    ui.notifications.notify(`${messagePrefix} to default preset`);
  }
  for (let sceneKey of scenesToRemove) {
    allPresets[presetId].sceneList.splice(allPresets[presetId].sceneList.indexOf(sceneKey), 1);
    allPresets[defaultPreset].sceneList.push(sceneKey);
    logger(`adding ${sceneKey} to preset ${allPresets[defaultPreset].titleText}`);
  }
  allPresets[presetId].titleText = preset.titleText;
  allPresets[presetId].colorText = preset.colorText;

  await game.settings.set(modId,mainSettingKey,allPresets);
  refreshPresets();
}

async function deletePreset(presetId) {
  let allPresets = Settings.getPresets();
  for (let scene of allPresets[presetId].sceneList) {
    allPresets[defaultPreset].sceneList.push(scene);
  }
  delete allPresets[presetId];
  await game.settings.set(modId, mainSettingKey, allPresets);
  refreshPresets();
}

export class Settings {
  static registerSettings() {
    game.settings.register(modId, mainSettingKey, {
      scope: 'world',
      config: false,
      type: Object,
      default: {}
    });
    game.settings.register(modId, activePresetKey, {
      scope: 'client',
      config: false,
      type: String,
      default: null
    });
    game.settings.register(modId, currentNavIdsKey, {
      scope: 'world',
      config: false,
      type: Array,
      default: []
    });
    game.settings.register(modId, playerEnabledKey, {
      scope: 'world',
      config: true,
      type: Boolean,
      default: false,
      name: 'Enable presets for players',
      hint: 'Players will see the presets and will be able to open/close them, but wont be able to create, edit or delete them'
    });
    game.settings.register(modId, truncateNameKey, {
      scope: 'world',
      config: true,
      type: Boolean,
      default: true,
      name: 'Truncate Scene Names',
      hint: 'If disabled, scene name will not be truncated to 32 characters'
    });
  }
  static updatePresets(presets) {
    game.settings.set(modId, mainSettingKey, presets);
  }
  static getPresets() {
    let allPresets = game.settings.get(modId, mainSettingKey);
    if (game.user.isGM) {
      return allPresets;
    } else {
      return Object.keys(allPresets).filter(
        x => allPresets[x].sceneList.some(
          y => game.scenes.get(y)?.data.permission.default !== 0 || game.scenes.get(y)?.active
        )
      ).reduce((obj, key) => {
        obj[key] = allPresets[key];
        return obj;
      }, {});
    }
  }
  static getDefaultPreset() {
    return Object.keys(Settings.getPresets())[0];
  }
  static getActivePresetId() {
    let result = game.settings.get(modId, activePresetKey);
    return result ? result : Settings.getDefaultPreset();
  }
  static async activatePreset(newPresetId) {
    await game.settings.set(modId, activePresetKey, newPresetId);
  }
  static async checkActivePresetExists() {
    let allPresets = Settings.getPresets();
    let activePreset = game.settings.get(modId, activePresetKey);
    if (!Object.keys(allPresets).includes(activePreset)) {
      logger('active preset not longer exists, switching to default');
      await game.settings.set(modId, activePresetKey, Settings.getDefaultPreset());
    }
  }
}

class SceneNavigationPresets extends SceneNavigation {
  constructor(...args) {
    super(args);
  }

  /** @override */
  getData(options) {
    let truncateName = game.settings.get(modId, truncateNameKey);
    // modIdify Scene data
    const scenes = this.scenes.map(scene => {
      let data = scene.data.toObject(false);
      let users = game.users.filter(u => u.active && (u.viewedScene === scene.id));
      if (!truncateName)
        data.name = data.navName || data.name;
      else
        data.name = TextEditor.truncateText(data.navName || data.name, {maxLength: 32});
      data.users = users.map(u => {
        return {letter: u.name[0], color: u.data.color};
      });
      data.visible = (game.user.isGM || scene.isOwner || scene.active);
      data.css = [
        scene.isView ? 'view' : null,
        scene.active ? 'active' : null,
        data.permission.default === 0 ? 'gm' : null
      ].filter(Boolean).join(' ');
        return data;
    });
    return {
      collapsed: this._collapsed,
      scenes: scenes
    };
  }
}

Hooks.once('init', async function() {
  Hooks.on('setup', async function() {
    CONFIG.ui.nav = SceneNavigationPresets;
  })
  Settings.registerSettings();
  Hooks.once('renderSceneNavigation', function() {
    Hooks.call('renderSceneNavigationPresets');
  })
  Hooks.once('renderSceneNavigationPresets', async function() {
    if (game.user.isGM || game.settings.get(modId, playerEnabledKey)) {

      if (game.settings.get(modId, currentNavIdsKey).length === 0) {
        logger('no currentNavIdsKey set, grabbing');
        game.settings.set(modId, currentNavIdsKey, getVisibleNavIds())
      }

      if (Object.keys(Settings.getPresets()).length === 0) {
        logger('no presets found, calling initPresets()');
        await initPresets();
      }
      logger('presets found', {
        presets: Settings.getPresets()
      });
      setupPresets();
      addEventListeners();
    }
  });
});
