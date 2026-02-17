import List "mo:base/List";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import OrderedMap "mo:base/OrderedMap";
import Iter "mo:base/Iter";
import Int "mo:base/Int";
import Array "mo:base/Array";
import Debug "mo:base/Debug";
import Storage "blob-storage/Storage";
import MixinStorage "blob-storage/Mixin";
import OutCall "http-outcalls/outcall";
import AccessControl "authorization/access-control";

actor {
  let storage = Storage.new();
  include MixinStorage(storage);

  // Initialize the access control system
  let accessControlState = AccessControl.initState();

  var adminPassword : Text = "secret123";

  type Message = {
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
  };

  type Chatroom = {
    id : Nat;
    topic : Text;
    description : Text;
    mediaUrl : Text;
    mediaType : Text;
    createdAt : Int;
    messageCount : Nat;
    viewCount : Nat;
    pinnedVideoId : ?Nat;
    category : Text;
  };

  type UserProfile = {
    name : Text;
    avatarUrl : ?Text;
    anonId : Text;
    presetAvatar : ?Text;
  };

  type ActiveUser = {
    userId : Text;
    lastActive : Int;
  };

  type ChatroomWithLiveStatus = {
    id : Nat;
    topic : Text;
    description : Text;
    mediaUrl : Text;
    mediaType : Text;
    createdAt : Int;
    messageCount : Nat;
    viewCount : Nat;
    pinnedVideoId : ?Nat;
    isLive : Bool;
    activeUserCount : Nat;
    category : Text;
  };

  type LobbyChatroomCard = {
    id : Nat;
    topic : Text;
    description : Text;
    mediaUrl : Text;
    mediaType : Text;
    createdAt : Int;
    messageCount : Nat;
    presenceIndicator : Nat;
    pinnedVideoId : ?Nat;
    isLive : Bool;
    activeUserCount : Nat;
    category : Text;
  };

  type Reaction = {
    emoji : Text;
    count : Nat;
    users : List.List<Text>;
  };

  type MessageWithReactions = {
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

  type ReplyPreview = {
    messageId : Nat;
    sender : Text;
    contentSnippet : Text;
    mediaThumbnail : ?Text;
  };

  var nextMessageId = 0;
  var nextChatroomId = 0;

  transient let natMap = OrderedMap.Make<Nat>(Nat.compare);
  transient let principalMap = OrderedMap.Make<Principal>(Principal.compare);
  
  var chatrooms : OrderedMap.Map<Nat, Chatroom> = natMap.empty();
  var messages : OrderedMap.Map<Nat, List.List<Message>> = natMap.empty();
  var activeUsers : OrderedMap.Map<Nat, List.List<ActiveUser>> = natMap.empty();
  var reactions : OrderedMap.Map<Nat, List.List<Reaction>> = natMap.empty();
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

  func validateMediaUrl(url : Text, mediaType : Text) : Bool {
    let lowerUrl = Text.toLowercase(url);
    switch (mediaType) {
      case ("image") {
        isValidImageUrl(lowerUrl);
      };
      case ("youtube") {
        isValidYouTubeUrl(lowerUrl);
      };
      case ("twitch") {
        isValidTwitchUrl(lowerUrl);
      };
      case ("twitter") {
        isValidTwitterUrl(lowerUrl);
      };
      case ("audio") {
        isValidAudioUrl(lowerUrl);
      };
      case (_) { false };
    };
  };

  func isValidImageUrl(url : Text) : Bool {
    let isBlobStorage = Text.contains(url, #text "blob-storage");
    if (isBlobStorage) {
      return true;
    };

    let hasImageExtension = Text.endsWith(url, #text ".jpg") or Text.endsWith(url, #text ".jpeg") or Text.endsWith(url, #text ".png") or Text.endsWith(url, #text ".gif");
    hasImageExtension;
  };

  func isValidYouTubeUrl(url : Text) : Bool {
    Text.contains(url, #text "youtube.com") or Text.contains(url, #text "youtu.be");
  };

  func isValidTwitchUrl(url : Text) : Bool {
    Text.contains(url, #text "twitch.tv") or Text.contains(url, #text "clips.twitch.tv");
  };

  func isValidTwitterUrl(url : Text) : Bool {
    Text.contains(url, #text "twitter.com") or Text.contains(url, #text "x.com");
  };

  func isValidAudioUrl(url : Text) : Bool {
    let isBlobStorage = Text.contains(url, #text "blob-storage");
    if (isBlobStorage) {
      return true;
    };

    let hasAudioExtension = Text.endsWith(url, #text ".mp3") or Text.endsWith(url, #text ".ogg") or Text.endsWith(url, #text ".wav");
    hasAudioExtension;
  };

  // Guest-accessible: Anyone can view lobby cards
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

  // Guest-accessible: Anyone can view chatrooms
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

        let safeMediaUrl = stripBase64FromUrl(chatroom.mediaUrl);
        let safeDescription = "";

        {
          id = chatroom.id;
          topic = chatroom.topic;
          description = safeDescription;
          mediaUrl = safeMediaUrl;
          mediaType = chatroom.mediaType;
          createdAt = chatroom.createdAt;
          messageCount = chatroom.messageCount;
          viewCount = chatroom.viewCount;
          pinnedVideoId = null;
          isLive = activeUserCount > 0;
          activeUserCount;
          category = chatroom.category;
        };
      },
    );

    var chatroomsArray = Iter.toArray(chatroomsWithLiveStatus);

    let maxChatrooms = 1000000;
    if (chatroomsArray.size() > maxChatrooms) {
      chatroomsArray := Array.tabulate<ChatroomWithLiveStatus>(
        maxChatrooms,
        func(i : Nat) : ChatroomWithLiveStatus {
          chatroomsArray[i];
        },
      );
    };

    chatroomsArray;
  };

  func stripBase64FromUrl(url : Text) : Text {
    if (Text.startsWith(url, #text "data:")) {
      return "";
    };
    url;
  };

  // Guest-accessible: Anyone can view a chatroom
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

  // Guest-accessible: Anyone can view messages
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

  // Guest-accessible: Anyone can increment view count
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

  // Guest-accessible: Anyone can view pinned video
  public query func getPinnedVideo(chatroomId : Nat) : async ?Nat {
    switch (natMap.get(chatrooms, chatroomId)) {
      case (null) { null };
      case (?chatroom) { chatroom.pinnedVideoId };
    };
  };

  // Guest-accessible: Anyone can search chatrooms
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

  // Guest-accessible: Anyone can filter by category
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

  // User-only: Fetching external content requires authentication
  public shared ({ caller }) func fetchYouTubeThumbnail(videoId : Text) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can fetch thumbnails");
    };
    let thumbnailUrl = "https://img.youtube.com/vi/" # videoId # "/hqdefault.jpg";
    await OutCall.httpGetRequest(thumbnailUrl, [], transform);
  };

  // User-only: Fetching external content requires authentication
  public shared ({ caller }) func fetchTwitchThumbnail(channelName : Text) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can fetch thumbnails");
    };
    let thumbnailUrl = "https://static-cdn.jtvnw.net/previews-ttv/live_user_" # channelName # "-640x360.jpg";
    await OutCall.httpGetRequest(thumbnailUrl, [], transform);
  };

  // User-only: Fetching external content requires authentication
  public shared ({ caller }) func fetchTwitterOEmbed(tweetUrl : Text) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can fetch embeds");
    };
    let oembedUrl = "https://publish.twitter.com/oembed?url=" # tweetUrl;
    await OutCall.httpGetRequest(oembedUrl, [], transform);
  };

  // User-only: Fetching external content requires authentication
  public shared ({ caller }) func fetchTwitterThumbnail(tweetUrl : Text) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can fetch thumbnails");
    };
    let apiUrl = "https://api.twitter.com/1.1/statuses/show.json?id=" # tweetUrl;
    await OutCall.httpGetRequest(apiUrl, [], transform);
  };

  // Guest-accessible: Anyone can view messages with reactions
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

  // Guest-accessible: Anyone can view reply previews
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

  // Guest-accessible: Anyone can view replies
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
