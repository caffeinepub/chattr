import List "mo:base/List";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import OrderedMap "mo:base/OrderedMap";
import Iter "mo:base/Iter";
import Int "mo:base/Int";
import Array "mo:base/Array";
import Principal "mo:base/Principal";
import Debug "mo:base/Debug";
import Storage "blob-storage/Storage";
import MixinStorage "blob-storage/Mixin";
import OutCall "http-outcalls/outcall";
import AccessControl "authorization/access-control";
import Migration "migration";

(with migration = Migration.run)
actor {
  let storage = Storage.new();
  include MixinStorage(storage);

  // Initialize the access control system
  let accessControlState = AccessControl.initState();

  public type Message = {
    id : Nat;
    content : Text;
    timestamp : Int;
    sender : Text;
    chatroomId : Nat;
    mediaUrl : ?Text;
    mediaType : ?Text;
    avatarUrl : ?Text;
    senderId : Text;
    replyToMessageId : ?Nat;
    imageId : ?Nat;
    giphyUrl : ?Text;
  };

  public type Chatroom = {
    id : Nat;
    topic : Text;
    description : Text;
    mediaUrl : ?Text;
    mediaType : ?Text;
    createdAt : Int;
    messageCount : Nat;
    viewCount : Nat;
    pinnedVideoId : ?Nat;
    category : Text;
  };

  public type ActiveUser = {
    userId : Text;
    lastActive : Int;
  };

  public type ChatroomWithLiveStatus = {
    id : Nat;
    topic : Text;
    description : Text;
    mediaUrl : ?Text;
    mediaType : ?Text;
    createdAt : Int;
    messageCount : Nat;
    viewCount : Nat;
    pinnedVideoId : ?Nat;
    isLive : Bool;
    activeUserCount : Nat;
    category : Text;
  };

  public type LobbyChatroomCard = {
    id : Nat;
    topic : Text;
    description : Text;
    mediaUrl : ?Text;
    mediaType : ?Text;
    createdAt : Int;
    messageCount : Nat;
    presenceIndicator : Nat;
    pinnedVideoId : ?Nat;
    isLive : Bool;
    activeUserCount : Nat;
    category : Text;
  };

  public type Reaction = {
    emoji : Text;
    count : Nat;
    users : List.List<Text>;
  };

  public type MessageWithReactions = {
    id : Nat;
    content : Text;
    timestamp : Int;
    sender : Text;
    chatroomId : Nat;
    mediaUrl : ?Text;
    mediaType : ?Text;
    avatarUrl : ?Text;
    senderId : Text;
    reactions : List.List<Reaction>;
    replyToMessageId : ?Nat;
  };

  public type ReplyPreview = {
    messageId : Nat;
    sender : Text;
    contentSnippet : Text;
    mediaThumbnail : ?Text;
  };

  public type UserProfile = {
    name : Text;
    avatarUrl : ?Text;
  };

  var nextMessageId = 0;
  var nextChatroomId = 0;
  var nextImageId = 0;

  transient let natMap = OrderedMap.Make<Nat>(Nat.compare);
  transient let principalMap = OrderedMap.Make<Principal>(Principal.compare);
  var chatrooms : OrderedMap.Map<Nat, Chatroom> = natMap.empty();
  var messages : OrderedMap.Map<Nat, List.List<Message>> = natMap.empty();
  var activeUsers : OrderedMap.Map<Nat, List.List<ActiveUser>> = natMap.empty();
  var reactions : OrderedMap.Map<Nat, List.List<Reaction>> = natMap.empty();
  var imageStorage : OrderedMap.Map<Nat, Storage.ExternalBlob> = natMap.empty();
  var userProfiles = principalMap.empty<UserProfile>();

  // Access Control Functions
  public shared ({ caller }) func initializeAccessControl() : async () {
    AccessControl.initialize(accessControlState, caller);
  };

  public query ({ caller }) func getCallerUserRole() : async AccessControl.UserRole {
    AccessControl.getUserRole(accessControlState, caller);
  };

  public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
    AccessControl.assignRole(accessControlState, caller, user, role);
  };

  public query ({ caller }) func isCallerAdmin() : async Bool {
    AccessControl.isAdmin(accessControlState, caller);
  };

  // User Profile Functions
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can access profiles");
    };
    principalMap.get(userProfiles, caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Debug.trap("Unauthorized: Can only view your own profile");
    };
    principalMap.get(userProfiles, user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles := principalMap.put(userProfiles, caller, profile);
  };

  // Admin-only: Delete chatroom
  public shared ({ caller }) func deleteChatroomWithPassword(chatroomId : Nat, password : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only admins can delete chatrooms");
    };

    if (password != "lunasimbaliamsammy1987!") {
      return;
    };

    switch (natMap.get(chatrooms, chatroomId)) {
      case (null) {};
      case (?_chatroom) {
        chatrooms := natMap.delete(chatrooms, chatroomId);
        messages := natMap.delete(messages, chatroomId);
        activeUsers := natMap.delete(activeUsers, chatroomId);

        var updatedReactions = reactions;
        for ((messageId, _messageReactions) in natMap.entries(reactions)) {
          let messageExistsInChatroom = switch (natMap.get(messages, chatroomId)) {
            case (null) { false };
            case (?chatroomMessages) {
              List.some<Message>(
                chatroomMessages,
                func(msg) { msg.id == messageId },
              );
            };
          };
          if (messageExistsInChatroom) {
            updatedReactions := natMap.delete(updatedReactions, messageId);
          };
        };
        reactions := updatedReactions;
      };
    };
  };

  // Users can create chatrooms
  public shared ({ caller }) func createChatroom(topic : Text, description : Text, mediaUrl : Text, mediaType : Text, category : Text) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can create chatrooms");
    };

    let chatroom : Chatroom = {
      id = nextChatroomId;
      topic;
      description;
      mediaUrl = if (Text.size(mediaUrl) > 0) { ?mediaUrl } else { null };
      mediaType = if (Text.size(mediaType) > 0) { ?mediaType } else { null };
      createdAt = Time.now();
      messageCount = 1;
      viewCount = 0;
      pinnedVideoId = null;
      category;
    };

    chatrooms := natMap.put(chatrooms, nextChatroomId, chatroom);
    messages := natMap.put(messages, nextChatroomId, List.nil<Message>());

    let firstMessage : Message = {
      id = nextMessageId;
      content = "Media content posted by creator";
      timestamp = Time.now();
      sender = "Creator";
      chatroomId = nextChatroomId;
      mediaUrl = if (Text.size(mediaUrl) > 0) { ?mediaUrl } else { null };
      mediaType = if (Text.size(mediaType) > 0) { ?mediaType } else { null };
      avatarUrl = null;
      senderId = Principal.toText(caller);
      replyToMessageId = null;
      imageId = null;
      giphyUrl = null;
    };

    messages := natMap.put(messages, nextChatroomId, List.push(firstMessage, List.nil<Message>()));
    nextMessageId += 1;
    nextChatroomId += 1;
    chatroom.id;
  };

  // Anyone including guests can view lobby
  public query func getLobbyChatroomCards() : async [LobbyChatroomCard] {
    if (natMap.size(chatrooms) == 0) {
      return [];
    };

    let currentTime = Time.now();
    let activeThreshold = 60 * 1_000_000_000;

    let lobbyCards = Iter.map<Chatroom, LobbyChatroomCard>(
      natMap.vals(chatrooms),
      func(chatroom) {
        let activeUsersForRoom = switch (natMap.get(activeUsers, chatroom.id)) {
          case (null) { List.nil<ActiveUser>() };
          case (?users) { users };
        };

        let activeUserCount = List.size(
          List.filter<ActiveUser>(
            activeUsersForRoom,
            func(user) {
              Int.abs(currentTime - user.lastActive) <= activeThreshold;
            },
          )
        );

        {
          chatroom with
          presenceIndicator = if (activeUserCount > 0) {
            activeUserCount;
          } else {
            chatroom.viewCount;
          };
          isLive = activeUserCount > 0;
          activeUserCount;
        };
      },
    );

    Iter.toArray(lobbyCards);
  };

  // Anyone including guests can view chatrooms
  public query func getChatrooms() : async [ChatroomWithLiveStatus] {
    if (natMap.size(chatrooms) == 0) {
      return [];
    };

    let currentTime = Time.now();
    let activeThreshold = 60 * 1_000_000_000;

    let chatroomsWithLiveStatus = Iter.map<Chatroom, ChatroomWithLiveStatus>(
      natMap.vals(chatrooms),
      func(chatroom) {
        let activeUsersForRoom = switch (natMap.get(activeUsers, chatroom.id)) {
          case (null) { List.nil<ActiveUser>() };
          case (?users) { users };
        };

        let activeUserCount = List.size(
          List.filter<ActiveUser>(
            activeUsersForRoom,
            func(user) {
              Int.abs(currentTime - user.lastActive) <= activeThreshold;
            },
          )
        );

        {
          chatroom with
          isLive = activeUserCount > 0;
          activeUserCount;
        };
      },
    );

    Iter.toArray(chatroomsWithLiveStatus);
  };

  // Anyone including guests can view a chatroom
  public query func getChatroom(id : Nat) : async ?ChatroomWithLiveStatus {
    switch (natMap.get(chatrooms, id)) {
      case (null) { null };
      case (?chatroom) {
        let currentTime = Time.now();
        let activeThreshold = 60 * 1_000_000_000;

        let activeUsersForRoom = switch (natMap.get(activeUsers, id)) {
          case (null) { List.nil<ActiveUser>() };
          case (?users) { users };
        };

        let activeUserCount = List.size(
          List.filter<ActiveUser>(
            activeUsersForRoom,
            func(user) {
              Int.abs(currentTime - user.lastActive) <= activeThreshold;
            },
          )
        );

        ?{
          chatroom with
          isLive = activeUserCount > 0;
          activeUserCount;
        };
      };
    };
  };

  // Users can send messages
  public shared ({ caller }) func sendMessage(content : Text, sender : Text, chatroomId : Nat, mediaUrl : ?Text, mediaType : ?Text, avatarUrl : ?Text, senderId : Text, replyToMessageId : ?Nat, imageId : ?Nat, giphyUrl : ?Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can send messages");
    };

    switch (natMap.get(chatrooms, chatroomId)) {
      case (null) {};
      case (?chatroom) {
        let message : Message = {
          id = nextMessageId;
          content;
          timestamp = Time.now();
          sender;
          chatroomId;
          mediaUrl;
          mediaType;
          avatarUrl;
          senderId;
          replyToMessageId;
          imageId;
          giphyUrl;
        };

        let chatroomMessages = switch (natMap.get(messages, chatroomId)) {
          case (null) { List.nil<Message>() };
          case (?existingMessages) { existingMessages };
        };

        messages := natMap.put(messages, chatroomId, List.push(message, chatroomMessages));
        nextMessageId += 1;

        let updatedChatroom = {
          chatroom with
          messageCount = chatroom.messageCount + 1
        };
        chatrooms := natMap.put(chatrooms, chatroomId, updatedChatroom);

        let currentTime = Time.now();
        let activeUsersForRoom = switch (natMap.get(activeUsers, chatroomId)) {
          case (null) { List.nil<ActiveUser>() };
          case (?users) { users };
        };

        let updatedActiveUsers = List.push(
          {
            userId = senderId;
            lastActive = currentTime;
          },
          List.filter<ActiveUser>(
            activeUsersForRoom,
            func(user) { user.userId != senderId },
          ),
        );

        activeUsers := natMap.put(activeUsers, chatroomId, updatedActiveUsers);
      };
    };
  };

  // Users can store images
  public shared ({ caller }) func storeImage(blob : Storage.ExternalBlob) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can store images");
    };

    let imageId = nextImageId;
    imageStorage := natMap.put(imageStorage, imageId, blob);
    nextImageId += 1;
    imageId;
  };

  // Anyone including guests can view images
  public query func getImage(imageId : Nat) : async ?Storage.ExternalBlob {
    natMap.get(imageStorage, imageId);
  };

  // Anyone including guests can view messages
  public query func getMessages(chatroomId : Nat) : async [Message] {
    switch (natMap.get(messages, chatroomId)) {
      case (null) { [] };
      case (?chatroomMessages) {
        let sortedMessages = List.toArray(chatroomMessages);
        Array.sort<Message>(
          sortedMessages,
          func(a : Message, b : Message) : { #less; #equal; #greater } {
            if (a.timestamp < b.timestamp) { #less } else if (a.timestamp == b.timestamp) {
              #equal;
            } else { #greater };
          },
        );
      };
    };
  };

  // Anyone including guests can increment view count
  public func incrementViewCount(chatroomId : Nat, userId : Text) : async () {
    switch (natMap.get(chatrooms, chatroomId)) {
      case (null) {};
      case (?chatroom) {
        let updatedChatroom = {
          chatroom with
          viewCount = chatroom.viewCount + 1
        };
        chatrooms := natMap.put(chatrooms, chatroomId, updatedChatroom);

        let currentTime = Time.now();
        let activeUsersForRoom = switch (natMap.get(activeUsers, chatroomId)) {
          case (null) { List.nil<ActiveUser>() };
          case (?users) { users };
        };

        let updatedActiveUsers = List.push(
          {
            userId;
            lastActive = currentTime;
          },
          List.filter<ActiveUser>(
            activeUsersForRoom,
            func(user) { user.userId != userId },
          ),
        );

        activeUsers := natMap.put(activeUsers, chatroomId, updatedActiveUsers);
      };
    };
  };

  // Admin-only: Pin video
  public shared ({ caller }) func pinVideo(chatroomId : Nat, messageId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only admins can pin videos");
    };

    switch (natMap.get(chatrooms, chatroomId)) {
      case (null) {};
      case (?chatroom) {
        let updatedChatroom = {
          chatroom with
          pinnedVideoId = ?messageId
        };
        chatrooms := natMap.put(chatrooms, chatroomId, updatedChatroom);
      };
    };
  };

  // Admin-only: Unpin video
  public shared ({ caller }) func unpinVideo(chatroomId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only admins can unpin videos");
    };

    switch (natMap.get(chatrooms, chatroomId)) {
      case (null) {};
      case (?chatroom) {
        let updatedChatroom = {
          chatroom with
          pinnedVideoId = null
        };
        chatrooms := natMap.put(chatrooms, chatroomId, updatedChatroom);
      };
    };
  };

  // Anyone including guests can view pinned video
  public query func getPinnedVideo(chatroomId : Nat) : async ?Nat {
    switch (natMap.get(chatrooms, chatroomId)) {
      case (null) { null };
      case (?chatroom) { chatroom.pinnedVideoId };
    };
  };

  // Admin-only: Update username retroactively
  public shared ({ caller }) func updateUsernameRetroactively(senderId : Text, newUsername : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only admins can update usernames retroactively");
    };

    var updatedMessages = messages;

    for ((chatroomId, chatroomMessages) in natMap.entries(messages)) {
      let updatedChatroomMessages = List.map<Message, Message>(
        chatroomMessages,
        func(message) {
          if (message.senderId == senderId) {
            {
              message with
              sender = newUsername;
            };
          } else {
            message;
          };
        },
      );
      updatedMessages := natMap.put(updatedMessages, chatroomId, updatedChatroomMessages);
    };

    messages := updatedMessages;
  };

  // Admin-only: Update avatar retroactively
  public shared ({ caller }) func updateAvatarRetroactively(senderId : Text, newAvatarUrl : ?Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only admins can update avatars retroactively");
    };

    var updatedMessages = messages;

    for ((chatroomId, chatroomMessages) in natMap.entries(messages)) {
      let updatedChatroomMessages = List.map<Message, Message>(
        chatroomMessages,
        func(message) {
          if (message.senderId == senderId) {
            {
              message with
              avatarUrl = newAvatarUrl;
            };
          } else {
            message;
          };
        },
      );
      updatedMessages := natMap.put(updatedMessages, chatroomId, updatedChatroomMessages);
    };

    messages := updatedMessages;
  };

  // Admin-only: Cleanup inactive users
  public shared ({ caller }) func cleanupInactiveUsers() : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only admins can cleanup inactive users");
    };

    let currentTime = Time.now();
    let activeThreshold = 60 * 1_000_000_000;

    var updatedActiveUsers = activeUsers;

    for ((chatroomId, users) in natMap.entries(activeUsers)) {
      let filteredUsers = List.filter<ActiveUser>(
        users,
        func(user) {
          Int.abs(currentTime - user.lastActive) <= activeThreshold;
        },
      );
      updatedActiveUsers := natMap.put(updatedActiveUsers, chatroomId, filteredUsers);
    };

    activeUsers := updatedActiveUsers;
  };

  // Users can add reactions
  public shared ({ caller }) func addReaction(messageId : Nat, emoji : Text, userId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can add reactions");
    };

    let messageReactions = switch (natMap.get(reactions, messageId)) {
      case (null) { List.nil<Reaction>() };
      case (?existingReactions) { existingReactions };
    };

    let (updatedReactions, found) = List.foldLeft<Reaction, (List.List<Reaction>, Bool)>(
      messageReactions,
      (List.nil<Reaction>(), false),
      func((acc, found), reaction) {
        if (reaction.emoji == emoji) {
          let hasReacted = List.some<Text>(
            reaction.users,
            func(user) { user == userId },
          );

          if (not hasReacted) {
            let updatedReaction = {
              reaction with
              count = reaction.count + 1;
              users = List.push(userId, reaction.users);
            };
            (List.push(updatedReaction, acc), true);
          } else {
            (List.push(reaction, acc), true);
          };
        } else {
          (List.push(reaction, acc), found);
        };
      },
    );

    if (not found) {
      let newReaction : Reaction = {
        emoji;
        count = 1;
        users = List.push(userId, List.nil<Text>());
      };
      reactions := natMap.put(reactions, messageId, List.push(newReaction, messageReactions));
    } else {
      reactions := natMap.put(reactions, messageId, List.reverse(updatedReactions));
    };
  };

  // Users can remove reactions
  public shared ({ caller }) func removeReaction(messageId : Nat, emoji : Text, userId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can remove reactions");
    };

    let messageReactions = switch (natMap.get(reactions, messageId)) {
      case (null) { List.nil<Reaction>() };
      case (?existingReactions) { existingReactions };
    };

    let updatedReactions = List.map<Reaction, Reaction>(
      messageReactions,
      func(reaction) {
        if (reaction.emoji == emoji) {
          {
            reaction with
            count = if (reaction.count > 0) { reaction.count - 1 : Nat } else { 0 };
            users = List.filter<Text>(
              reaction.users,
              func(user) { user != userId },
            );
          };
        } else {
          reaction;
        };
      },
    );

    reactions := natMap.put(reactions, messageId, updatedReactions);
  };

  // Anyone including guests can view reactions
  public query func getReactions(messageId : Nat) : async [Reaction] {
    switch (natMap.get(reactions, messageId)) {
      case (null) { [] };
      case (?messageReactions) { List.toArray(messageReactions) };
    };
  };

  // Anyone including guests can search chatrooms
  public query func searchChatrooms(searchTerm : Text) : async [ChatroomWithLiveStatus] {
    let lowerSearchTerm = Text.toLowercase(searchTerm);

    if (natMap.size(chatrooms) == 0) {
      return [];
    };

    let currentTime = Time.now();
    let activeThreshold = 60 * 1_000_000_000;

    let chatroomsWithLiveStatus = Iter.map<Chatroom, ChatroomWithLiveStatus>(
      natMap.vals(chatrooms),
      func(chatroom) {
        let activeUsersForRoom = switch (natMap.get(activeUsers, chatroom.id)) {
          case (null) { List.nil<ActiveUser>() };
          case (?users) { users };
        };

        let activeUserCount = List.size(
          List.filter<ActiveUser>(
            activeUsersForRoom,
            func(user) {
              Int.abs(currentTime - user.lastActive) <= activeThreshold;
            },
          )
        );

        {
          chatroom with
          isLive = activeUserCount > 0;
          activeUserCount;
        };
      },
    );

    let filteredChatrooms = Iter.filter<ChatroomWithLiveStatus>(
      chatroomsWithLiveStatus,
      func(chatroom) {
        let lowerTopic = Text.toLowercase(chatroom.topic);
        let lowerDescription = Text.toLowercase(chatroom.description);
        let lowerCategory = Text.toLowercase(chatroom.category);

        Text.contains(lowerTopic, #text lowerSearchTerm) or Text.contains(lowerDescription, #text lowerSearchTerm) or Text.contains(lowerCategory, #text lowerSearchTerm);
      },
    );

    Iter.toArray(filteredChatrooms);
  };

  // Anyone including guests can filter chatrooms by category
  public query func filterChatroomsByCategory(category : Text) : async [ChatroomWithLiveStatus] {
    let lowerCategory = Text.toLowercase(category);

    if (natMap.size(chatrooms) == 0) {
      return [];
    };

    let currentTime = Time.now();
    let activeThreshold = 60 * 1_000_000_000;

    let chatroomsWithLiveStatus = Iter.map<Chatroom, ChatroomWithLiveStatus>(
      natMap.vals(chatrooms),
      func(chatroom) {
        let activeUsersForRoom = switch (natMap.get(activeUsers, chatroom.id)) {
          case (null) { List.nil<ActiveUser>() };
          case (?users) { users };
        };

        let activeUserCount = List.size(
          List.filter<ActiveUser>(
            activeUsersForRoom,
            func(user) {
              Int.abs(currentTime - user.lastActive) <= activeThreshold;
            },
          )
        );

        {
          chatroom with
          isLive = activeUserCount > 0;
          activeUserCount;
        };
      },
    );

    let filteredChatrooms = Iter.filter<ChatroomWithLiveStatus>(
      chatroomsWithLiveStatus,
      func(chatroom) {
        Text.toLowercase(chatroom.category) == lowerCategory;
      },
    );

    Iter.toArray(filteredChatrooms);
  };

  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  // Anyone including guests can fetch YouTube thumbnails
  public func fetchYouTubeThumbnail(videoId : Text) : async Text {
    let thumbnailUrl = "https://img.youtube.com/vi/" # videoId # "/hqdefault.jpg";
    await OutCall.httpGetRequest(thumbnailUrl, [], transform);
  };

  // Anyone including guests can fetch Twitch thumbnails
  public func fetchTwitchThumbnail(channelName : Text) : async Text {
    let thumbnailUrl = "https://static-cdn.jtvnw.net/previews-ttv/live_user_" # channelName # "-640x360.jpg";
    await OutCall.httpGetRequest(thumbnailUrl, [], transform);
  };

  // Anyone including guests can fetch Twitter OEmbed
  public func fetchTwitterOEmbed(tweetUrl : Text) : async Text {
    let oembedUrl = "https://publish.twitter.com/oembed?url=" # tweetUrl;
    await OutCall.httpGetRequest(oembedUrl, [], transform);
  };

  // Anyone including guests can fetch Twitter thumbnails
  public func fetchTwitterThumbnail(tweetUrl : Text) : async Text {
    let apiUrl = "https://api.twitter.com/1.1/statuses/show.json?id=" # tweetUrl;
    await OutCall.httpGetRequest(apiUrl, [], transform);
  };

  // Anyone including guests can view messages with reactions
  public query func getMessageWithReactionsAndReplies(chatroomId : Nat) : async [MessageWithReactions] {
    switch (natMap.get(messages, chatroomId)) {
      case (null) { [] };
      case (?chatroomMessages) {
        let sortedMessages = List.toArray(chatroomMessages);
        let sortedWithReactions = Array.sort<Message>(
          sortedMessages,
          func(a : Message, b : Message) : { #less; #equal; #greater } {
            if (a.timestamp < b.timestamp) { #less } else if (a.timestamp == b.timestamp) {
              #equal;
            } else { #greater };
          },
        );
        Array.map<Message, MessageWithReactions>(
          sortedWithReactions,
          func(message) {
            let messageReactions = switch (natMap.get(reactions, message.id)) {
              case (null) { List.nil<Reaction>() };
              case (?existingReactions) { existingReactions };
            };

            {
              message with
              reactions = messageReactions;
            };
          },
        );
      };
    };
  };

  // Anyone including guests can view reply previews
  public query func getReplyPreview(chatroomId : Nat, messageId : Nat) : async ?ReplyPreview {
    switch (natMap.get(messages, chatroomId)) {
      case (null) { null };
      case (?chatroomMessages) {
        let message = List.find<Message>(
          chatroomMessages,
          func(msg) { msg.id == messageId },
        );

        switch (message) {
          case (null) { null };
          case (?msg) {
            let contentSnippet = if (Text.size(msg.content) > 100) {
              truncateText(msg.content, 100);
            } else {
              msg.content;
            };

            ?{
              messageId;
              sender = msg.sender;
              contentSnippet;
              mediaThumbnail = msg.mediaUrl;
            };
          };
        };
      };
    };
  };

  // Anyone including guests can view replies
  public query func getReplies(chatroomId : Nat, parentMessageId : Nat) : async [Message] {
    switch (natMap.get(messages, chatroomId)) {
      case (null) { [] };
      case (?chatroomMessages) {
        let replies = List.filter<Message>(
          chatroomMessages,
          func(msg) {
            switch (msg.replyToMessageId) {
              case (null) { false };
              case (?replyId) { replyId == parentMessageId };
            };
          },
        );

        let sortedReplies = List.toArray(replies);
        Array.sort<Message>(
          sortedReplies,
          func(a : Message, b : Message) : { #less; #equal; #greater } {
            if (a.timestamp < b.timestamp) { #less } else if (a.timestamp == b.timestamp) { #equal } else {
              #greater;
            };
          },
        );
      };
    };
  };

  func truncateText(text : Text, maxLength : Nat) : Text {
    let chars = Text.toArray(text);
    let length = if (chars.size() > maxLength) { maxLength } else { chars.size() };
    Text.fromArray(Array.tabulate(length, func(i : Nat) : Char { chars[i] }));
  };
};
