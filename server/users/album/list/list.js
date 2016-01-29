// Fetch media list


'use strict';

var MEDIAS_PER_PAGE = 30;


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true },
    album_id: { format: 'mongo' },
    from_media_id: { format: 'mongo' }
  });


  // Fetch user
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Find and processes user media
  //
  N.wire.on(apiPath, function* get_user_medias(env) {
    var criteria = {
      type: { $in: N.models.users.MediaInfo.types.LIST_VISIBLE }
    };

    // If album_id not set, will fetch all user medias
    if (env.params.album_id) {
      criteria.album_id = env.params.album_id;
    } else {
      criteria.user_id = env.data.user._id;
    }

    // Get photos from `from_media_id`
    if (env.params.from_media_id) {
      criteria.media_id = { $lte: env.params.from_media_id };
    }

    let result = yield N.models.users.MediaInfo
                          .find(criteria)
                          .lean(true)
                          .sort('-media_id')
                          // Select one extra item to check next page exists
                          .limit(MEDIAS_PER_PAGE + 1);

    if (result.length === MEDIAS_PER_PAGE + 1) {
      // Remove extra item from response and fill `next_media_id`
      env.res.next_media_id = result.pop().media_id;
    } else {
      env.res.next_media_id = null;
    }

    env.res.user_hid = env.data.user.hid;
    env.res.medias = result;
  });
};
