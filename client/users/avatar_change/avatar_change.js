// Change avatar dialog
//

'use strict';

var readExif = require('nodeca.users/lib/exif');

// Avatar upload finish callback
var onUploaded;

// Original image
var image;

// Avatar size config
var avatarWidth = '$$ N.config.users.avatars.resize.orig.width $$';
var avatarHeight = '$$ N.config.users.avatars.resize.orig.height $$';

// The ratio of displayable image width to real image width
var scale;

// Dialog data (data.avatar_id will be filled after upload)
var data;

var $dialog;
var $selectArea;
var $canvas;
var $canvasPreview;


// Update select area position
//
function updateSelectArea() {
  scale = $canvas.width() / $canvas[0].width;

  var minSize = avatarWidth * scale;
  var sizeX, sizeY, left, top;
  var height = $canvas.height(), width = $canvas.width();

  sizeX = sizeY = parseInt(Math.max(Math.min(height, width) / 4, minSize), 10);
  left = parseInt(width / 2 - sizeX / 2, 10);
  top = parseInt(height / 2 - sizeY / 2, 10);

  $selectArea.css({
    top: top + 'px',
    left: left + 'px',
    width: sizeX + 'px',
    height: sizeY + 'px'
  });
}


// Update preview canvas (crop by selected area)
//
function updatePreview() {
  var ctx = $canvasPreview[0].getContext('2d');

  var x = parseInt($selectArea.css('left'), 10);
  var y = parseInt($selectArea.css('top'), 10);

  var width = parseInt($selectArea.outerWidth(), 10);
  var height = parseInt($selectArea.outerHeight(), 10);

  width = parseInt(width / scale, 10);
  height = parseInt(height / scale, 10);

  $canvasPreview[0].width = width;
  $canvasPreview[0].height = height;

  ctx.drawImage($canvas[0], parseInt(x / scale, 10), parseInt(y / scale, 10), width, height, 0, 0, width, height);
}


// Event handler for moving selected area
//
function dragSelectArea(left, top, width, height, dX, dY) {
  var origWidth = parseInt($canvas.width(), 10);
  var origHeight = parseInt($canvas.height(), 10);
  var newLeft = left + dX;
  var newTop = top + dY;

  if (newLeft < 0) {
    newLeft = 0;
  }

  if (newTop < 0) {
    newTop = 0;
  }

  if (newLeft + width > origWidth) {
    newLeft = origWidth - width;
  }

  if (newTop + height > origHeight) {
    newTop = origHeight - height;
  }

  $selectArea.css('left', newLeft + 'px');
  $selectArea.css('top', newTop + 'px');
}


// Check is selected area into photo area
//
function checkFrames(newLeft, newTop, newWidth, newHeight, origWidth, origHeight, minSizeW, minSizeH) {
  return !(
    newLeft < 0 || newTop < 0 ||
    newLeft + newWidth > origWidth || newTop + newHeight > origHeight ||
    newWidth < minSizeW || newHeight < minSizeH
  );
}


// Event handler for resizing selected area
//
function resizeSelectArea(left, top, width, height, dX, dY, dir) {
  var newLeft, newTop, newWidth, newHeight, dS;

  var origWidth = parseInt($canvas.width(), 10);
  var origHeight = parseInt($canvas.height(), 10);

  var minSizeW = avatarWidth * scale;
  var minSizeH = avatarHeight * scale;

  switch (dir) {
    case 's':
      newHeight = newWidth = height + dY;
      newLeft = left - dY / 2;
      newTop = top;
      break;

    case 'n':
      newHeight = newWidth = height - dY;
      newLeft = left + dY / 2;
      newTop = top + dY;
      break;

    case 'w':
      newHeight = newWidth = width - dX;
      newLeft = left + dX;
      newTop = top + dX / 2;
      break;

    case 'e':
      newHeight = newWidth = width + dX;
      newLeft = left;
      newTop = top - dX / 2;
      break;

    case 'se':
      dS = Math.min(dX, dY);
      newLeft = left;
      newTop = top;
      newHeight = newWidth = width + dS;
      break;

    case 'nw':
      dS = Math.min(dX, dY);
      newLeft = left + dS;
      newTop = top + dS;
      newHeight = newWidth = width - dS;
      break;

    case 'ne':
      if (Math.abs(dX) > Math.abs(dY)) {
        dS = -dY;
      } else {
        dS = dX;
      }
      newLeft = left;
      newTop = top - dS;
      newHeight = newWidth = width + dS;
      break;

    case 'sw':
      if (Math.abs(dX) > Math.abs(dY)) {
        dS = dY;
      } else {
        dS = -dX;
      }
      newLeft = left - dS;
      newTop = top;
      newHeight = newWidth = width + dS;
      break;

    default:
      return;
  }

  if (!checkFrames(newLeft, newTop, newWidth, newHeight, origWidth, origHeight, minSizeW, minSizeH)) {
    return;
  }

  $selectArea.css({
    top: newTop + 'px',
    left: newLeft + 'px',
    width: newWidth + 'px',
    height: newHeight + 'px'
  });
}


// Init select area (bind to mouse events)
//
function initSelectArea() {
  var x, y, left, top, width, height, action = null;

  $('body')
    .on('mouseup.change_avatar touchend.change_avatar', function () {
      action = null;
    })
    .on('mousemove.change_avatar touchmove.change_avatar', function (event) {

      if (!action) {
        return;
      }

      var dX = event.pageX - x;
      var dY = event.pageY - y;

      if (action !== 'move') {
        resizeSelectArea(left, top, width, height, dX, dY, action);
      } else {
        dragSelectArea(left, top, width, height, dX, dY);
      }

      updatePreview();
    });

  $selectArea.on('mousedown touchstart', function (event) {
    x = event.pageX;
    y = event.pageY;
    left = parseInt($selectArea.css('left'), 10);
    top = parseInt($selectArea.css('top'), 10);
    width = parseInt($selectArea.outerWidth(), 10);
    height = parseInt($selectArea.outerHeight(), 10);
  });

  // All selection area selectors
  $('.avatar-change__select, .avatar-change__select *')

    // Disable dragstart event
    .on('dragstart', function () {
      return false;
    })
    .on('mousedown touchstart', function () {
      if (!action) {
        action = $(this).data('action');
      }
    });
}


// Apply JPEG orientation to canvas
//
function applyOrientation(canvas, ctx, orientation) {
  var width = canvas.width;
  var height = canvas.height;

  if (!orientation || orientation > 8) {
    return;
  }

  if (orientation > 4) {
    canvas.width = height;
    canvas.height = width;
  }

  switch (orientation) {

    case 2:
      // Horizontal flip
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      break;

    case 3:
      // 180 rotate left
      ctx.translate(width, height);
      ctx.rotate(Math.PI);
      break;

    case 4:
      // Vertical flip
      ctx.translate(0, height);
      ctx.scale(1, -1);
      break;

    case 5:
      // Vertical flip and 90 rotate right
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      break;

    case 6:
      // 90 rotate right
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(0, -height);
      break;

    case 7:
      // Horizontal flip + 90 rotate right
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(width, -height);
      ctx.scale(-1, 1);
      break;

    case 8:
      // 90 rotate left
      ctx.rotate(-0.5 * Math.PI);
      ctx.translate(-width, 0);
      break;

    default:
  }
}


// Load image from user's file
//
function loadImage(file) {
  var ctx = $canvas[0].getContext('2d');
  var orientation;

  image = new Image();
  image.onload = function () {

    if (image.width < avatarWidth || image.height < avatarHeight) {
      N.wire.emit('notify', t('err_invalid_size', { 'file_name': file.name }));
    }

    $canvas[0].width = image.width;
    $canvas[0].height = image.height;

    applyOrientation($canvas[0], ctx, orientation);

    ctx.drawImage(image, 0, 0, image.width, image.height);

    $canvas.removeClass('hidden');
    $selectArea.removeClass('hidden');
    $canvasPreview.removeClass('hidden');
    $('.avatar-change__text').addClass('hidden');

    updateSelectArea();
    updatePreview();
  };


  var reader = new FileReader();

  reader.onloadend = function (e) {
    var exifData = readExif(new Uint8Array(e.target.result));

    if (exifData && exifData.orientation) {
      orientation = exifData.orientation;
    }

    image.src = window.URL.createObjectURL(file);
  };

  reader.readAsArrayBuffer(file);
}


// Init dialog on event
//
N.wire.on('users.avatar_change', function show_change_avatar(params, callback) {
  data = params;
  onUploaded = callback;

  $dialog = $(N.runtime.render('users.avatar_change'));
  $('body').append($dialog);

  $(window).on('resize.change_avatar', function () {
    updateSelectArea();
    updatePreview();
  });
  // When dialog closes - remove it from body
  $dialog.on('hidden.bs.modal', function () {
    $dialog.remove();
    $dialog = null;

    $('body').off('mouseup.change_avatar touchend.change_avatar mousemove.change_avatar touchmove.change_avatar');
    $(window).off('resize.change_avatar');
    onUploaded = null;
    image = null;
  });

  $dialog.modal('show');
  $selectArea = $('.avatar-change__select');
  $canvas = $('.avatar-change__canvas');
  $canvasPreview = $('.avatar-change-preview');

  initSelectArea();

  $('.avatar-change-upload__files').on('change', function () {
    var files = $(this).get(0).files;
    if (files.length > 0) {
      loadImage(files[0]);
    }
  });
});


// Show system dialog file selection
//
N.wire.on('users.avatar_change:select_file', function select_file() {
  // If image already selected don't open select dialog again
  if (image) {
    return;
  }

  $('.avatar-change-upload__files').click();
});


// Handles the event when user drag file to drag drop zone
//
N.wire.on('users.avatar_change:dd_area', function change_avatar_dd(event) {
  var x0, y0, x1, y1, ex, ey;
  var $dropZone = $('.avatar-change');

  switch (event.type) {
    case 'dragenter':
      $dropZone.addClass('active');
      break;
    case 'dragleave':
      // 'dragleave' occurs when user move cursor over child HTML element
      // track this situation and don't remove 'active' class
      // http://stackoverflow.com/questions/10867506/
      x0 = $dropZone.offset().left;
      y0 = $dropZone.offset().top;
      x1 = x0 + $dropZone.outerWidth();
      y1 = y0 + $dropZone.outerHeight();
      ex = event.originalEvent.pageX;
      ey = event.originalEvent.pageY;

      if (ex > x1 || ex < x0 || ey > y1 || ey < y0) {
        $dropZone.removeClass('active');
      }
      break;
    case 'drop':
      $dropZone.removeClass('active');

      if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
        loadImage(event.dataTransfer.files[0]);
      }
      break;
    default:
  }
});


// Save selected avatar
//
N.wire.on('users.avatar_change:apply', function change_avatar_apply() {
  $canvasPreview[0].toBlob(function (blob) {
    var formData = new FormData();
    formData.append('file', blob);
    formData.append('csrf', N.runtime.csrf);

    $.ajax({
      url: N.router.linkTo('users.member.avatar.upload'),
      type: 'POST',
      data: formData,
      dataType: 'json',
      processData: false,
      contentType: false
    })
      .done(function (result) {
        data.avatar_id = result.avatar_id;
        $dialog.modal('hide');
        onUploaded();
      })
      .fail(function () {
        $dialog.modal('hide');
        N.wire.emit('notify', t('err_upload_failed'));
      });
  }, 'image/jpeg', 100);
});
