import AccessControl "authorization/access-control";

module {
  type OldActor = {
    // Old access control state (empty object)
    accessControlState : {};
  };

  type NewActor = {
    // New access control state with additional fields
    accessControlState : AccessControl.AccessControlState;
  };

  public func run(old : OldActor) : NewActor {
    // Initialize the new access control state
    {
      accessControlState = AccessControl.initState();
    };
  };
};
