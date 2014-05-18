(function(undefined) {
  // The Opal object that is exposed globally
  var Opal = this.Opal = {};

  // The actual class for BasicObject
  var RubyBasicObject;

  // The actual Object class
  var RubyObject;

  // The actual Module class
  var RubyModule;

  // The actual Class class
  var RubyClass;

  // Constructor for instances of BasicObject
  function BasicObject(){}

  // Constructor for instances of Object
  function Object(){}

  // Constructor for instances of Class
  function Class(){}

  // Constructor for instances of Module
  function Module(){}

  // Constructor for instances of NilClass (nil)
  function NilClass(){}

  // All bridged classes - keep track to donate methods from Object
  var bridged_classes = [];

  // TopScope is used for inheriting constants from the top scope
  var TopScope = function(){};

  // Opal just acts as the top scope
  TopScope.prototype = Opal;

  // To inherit scopes
  Opal.constructor  = TopScope;

  Opal.constants = [];

  // This is a useful reference to global object inside ruby files
  Opal.global = this;

  // Minify common function calls
  var opal$hasOwn = Opal.hasOwnProperty;
  var opal$slice  = Opal.slice = Array.prototype.slice;

  // Generates unique id for every ruby object
  var unique_id = 0;

  // Return next unique id
  Opal.uid = function() {
    return unique_id++;
  };

  // Table holds all class variables
  Opal.cvars = {};

  // Globals table
  Opal.gvars = {};

  /*
   * Create a new constants scope for the given class with the given
   * base. Constants are looked up through their parents, so the base
   * scope will be the outer scope of the new klass.
   */
  function create_scope(base, klass, id) {
    var const_alloc   = function() {};
    var const_scope   = const_alloc.prototype = new base.constructor();
    klass._scope      = const_scope;
    const_scope.base  = klass;
    klass._base_module = base.base;
    const_scope.constructor = const_alloc;
    const_scope.constants = [];

    if (id) {
      klass._orig_scope = base;
      base[id] = base.constructor[id] = klass;
      base.constants.push(id);
    }
  }

  Opal.create_scope = create_scope;

  /*
   * A `class Foo; end` expression in ruby is compiled to call this runtime
   * method which either returns an existing class of the given name, or creates
   * a new class in the given `base` scope.
   *
   * If a constant with the given name exists, then we check to make sure that
   * it is a class and also that the superclasses match. If either of these
   * fail, then we raise a `TypeError`. Note, superklass may be null if one was
   * not specified in the ruby code.
   *
   * We pass a constructor to this method of the form `function ClassName() {}`
   * simply so that classes show up with nicely formatted names inside debuggers
   * in the web browser (or node/sprockets).
   *
   * The `base` is the current `self` value where the class is being created
   * from. We use this to get the scope for where the class should be created.
   * If `base` is an object (not a class/module), we simple get its class and
   * use that as the base instead.
   *
   * @param [Object] base where the class is being created
   * @param [Class] superklass superclass of the new class (may be null)
   * @param [String] id the name of the class to be created
   * @param [Function] constructor function to use as constructor
   * @return [Class] new or existing ruby class
   */
  Opal.klass = function(base, superklass, id, constructor) {

    // If base is an object, use its class
    if (!base._isClass) {
      base = base._klass;
    }

    // Not specifying a superclass means we can assume it to be Object
    if (superklass === null) {
      superklass = RubyObject;
    }

    var klass = base._scope[id];

    // If a constant exists in the scope, then we must use that
    if (opal$hasOwn.call(base._scope, id) && klass._orig_scope === base._scope) {

      // Make sure the existing constant is a class, or raise error
      if (!klass._isClass) {
        throw Opal.TypeError.opal$new(id + " is not a class");
      }

      // Make sure existing class has same superclass
      if (superklass !== klass._super && superklass !== RubyObject) {
        throw Opal.TypeError.opal$new("superclass mismatch for class " + id);
      }
    }
    else if (typeof(superklass) === 'function') {
      // passed native constructor as superklass, so bridge it as ruby class
      return bridge_class(id, superklass);
    }
    else {
      // if class doesnt exist, create a new one with given superclass
      klass = boot_class(superklass, constructor);

      // name class using base (e.g. Foo or Foo::Baz)
      klass._name = id;

      // every class gets its own constant scope, inherited from current scope
      create_scope(base._scope, klass, id);

      // Name new class directly onto current scope (Opal.Foo.Baz = klass)
      base[id] = base._scope[id] = klass;

      // Copy all parent constants to child, unless parent is Object
      if (superklass !== RubyObject && superklass !== RubyBasicObject) {
        Opal.donate_constants(superklass, klass);
      }

      // call .inherited() hook with new class on the superclass
      if (superklass.opal$inherited) {
        superklass.opal$inherited(klass);
      }
    }

    return klass;
  };

  // Create generic class with given superclass.
  var boot_class = Opal.boot = function(superklass, constructor) {
    // instances
    var ctor = function() {};
        ctor.prototype = superklass._proto;

    constructor.prototype = new ctor();

    constructor.prototype.constructor = constructor;

    return boot_class_meta(superklass, constructor);
  };

  // class itself
  function boot_class_meta(superklass, constructor) {
    var mtor = function() {};
    mtor.prototype = superklass.constructor.prototype;

    function OpalClass() {};
    OpalClass.prototype = new mtor();

    var klass = new OpalClass();

    klass._id         = unique_id++;
    klass._alloc      = constructor;
    klass._isClass    = true;
    klass.constructor = OpalClass;
    klass._super      = superklass;
    klass._methods    = [];
    klass.__inc__     = [];
    klass.__parent    = superklass;
    klass._proto      = constructor.prototype;

    constructor.prototype._klass = klass;

    return klass;
  }

  // Define new module (or return existing module)
  Opal.module = function(base, id) {
    var module;

    if (!base._isClass) {
      base = base._klass;
    }

    if (opal$hasOwn.call(base._scope, id)) {
      module = base._scope[id];

      if (!module.__mod__ && module !== RubyObject) {
        throw Opal.TypeError.opal$new(id + " is not a module")
      }
    }
    else {
      module = boot_module()
      module._name = id;

      create_scope(base._scope, module, id);

      // Name new module directly onto current scope (Opal.Foo.Baz = module)
      base[id] = base._scope[id] = module;
    }

    return module;
  };

  /*
   * Internal function to create a new module instance. This simply sets up
   * the prototype hierarchy and method tables.
   */
  function boot_module() {
    var mtor = function() {};
    mtor.prototype = RubyModule.constructor.prototype;

    function OpalModule() {};
    OpalModule.prototype = new mtor();

    var module = new OpalModule();

    module._id         = unique_id++;
    module._isClass    = true;
    module.constructor = OpalModule;
    module._super      = RubyModule;
    module._methods    = [];
    module.__inc__     = [];
    module.__parent    = RubyModule;
    module._proto      = {};
    module.__mod__     = true;
    module.__dep__     = [];

    return module;
  }

  // Boot a base class (makes instances).
  var boot_defclass = function(id, constructor, superklass) {
    if (superklass) {
      var ctor           = function() {};
          ctor.prototype = superklass.prototype;

      constructor.prototype = new ctor();
    }

    constructor.prototype.constructor = constructor;

    return constructor;
  };

  // Boot the actual (meta?) classes of core classes
  var boot_makemeta = function(id, constructor, superklass) {

    var mtor = function() {};
    mtor.prototype  = superklass.prototype;

    function OpalClass() {};
    OpalClass.prototype = new mtor();

    var klass = new OpalClass();

    klass._id         = unique_id++;
    klass._alloc      = constructor;
    klass._isClass    = true;
    klass._name       = id;
    klass._super      = superklass;
    klass.constructor = OpalClass;
    klass._methods    = [];
    klass.__inc__     = [];
    klass.__parent    = superklass;
    klass._proto      = constructor.prototype;

    constructor.prototype._klass = klass;

    Opal[id] = klass;
    Opal.constants.push(id);

    return klass;
  };

  /*
   * For performance, some core ruby classes are toll-free bridged to their
   * native javascript counterparts (e.g. a ruby Array is a javascript Array).
   *
   * This method is used to setup a native constructor (e.g. Array), to have
   * its prototype act like a normal ruby class. Firstly, a new ruby class is
   * created using the native constructor so that its prototype is set as the
   * target for th new class. Note: all bridged classes are set to inherit
   * from Object.
   *
   * Bridged classes are tracked in `bridged_classes` array so that methods
   * defined on Object can be "donated" to all bridged classes. This allows
   * us to fake the inheritance of a native prototype from our Object
   * prototype.
   *
   * Example:
   *
   *    bridge_class("Proc", Function);
   *
   * @param [String] name the name of the ruby class to create
   * @param [Function] constructor native javascript constructor to use
   * @return [Class] returns new ruby class
   */
  function bridge_class(name, constructor) {
    var klass = boot_class_meta(RubyObject, constructor);

    klass._name = name;

    create_scope(Opal, klass, name);
    bridged_classes.push(klass);

    var object_methods = RubyBasicObject._methods.concat(RubyObject._methods);

    for (var i = 0, len = object_methods.length; i < len; i++) {
      var meth = object_methods[i];
      constructor.prototype[meth] = RubyObject._proto[meth];
    }

    return klass;
  };

  /*
   * constant assign
   */
  Opal.casgn = function(base_module, name, value) {
    var scope = base_module._scope;

    if (value._isClass && value._name === nil) {
      value._name = name;
    }

    if (value._isClass) {
      value._base_module = base_module;
    }

    scope.constants.push(name);
    return scope[name] = value;
  };

  /*
   * constant decl
   */
  Opal.cdecl = function(base_scope, name, value) {
    base_scope.constants.push(name);
    return base_scope[name] = value;
  };

  /*
   * constant get
   */
  Opal.cget = function(base_scope, path) {
    if (path == null) {
      path       = base_scope;
      base_scope = Opal.Object;
    }

    var result = base_scope;

    path = path.split('::');
    while (path.length != 0) {
      result = result.opal$const_get(path.shift());
    }

    return result;
  }

  /*
   * When a source module is included into the target module, we must also copy
   * its constants to the target.
   */
  Opal.donate_constants = function(source_mod, target_mod) {
    var source_constants = source_mod._scope.constants,
        target_scope     = target_mod._scope,
        target_constants = target_scope.constants;

    for (var i = 0, length = source_constants.length; i < length; i++) {
      target_constants.push(source_constants[i]);
      target_scope[source_constants[i]] = source_mod._scope[source_constants[i]];
    }
  };

  /*
   * Methods stubs are used to facilitate method_missing in opal. A stub is a
   * placeholder function which just calls `method_missing` on the receiver.
   * If no method with the given name is actually defined on an object, then it
   * is obvious to say that the stub will be called instead, and then in turn
   * method_missing will be called.
   *
   * When a file in ruby gets compiled to javascript, it includes a call to
   * this function which adds stubs for every method name in the compiled file.
   * It should then be safe to assume that method_missing will work for any
   * method call detected.
   *
   * Method stubs are added to the BasicObject prototype, which every other
   * ruby object inherits, so all objects should handle method missing. A stub
   * is only added if the given property name (method name) is not already
   * defined.
   *
   * Note: all ruby methods have a `opal$` prefix in javascript, so all stubs will
   * have this prefix as well (to make this method more performant).
   *
   *    Opal.add_stubs(["opal$foo", "opal$bar", "opal$baz="]);
   *
   * All stub functions will have a private `rb_stub` property set to true so
   * that other internal methods can detect if a method is just a stub or not.
   * `Kernel#respond_to?` uses this property to detect a methods presence.
   *
   * @param [Array] stubs an array of method stubs to add
   */
  Opal.add_stubs = function(stubs) {
    for (var i = 0, length = stubs.length; i < length; i++) {
      var stub = stubs[i];

      if (!BasicObject.prototype[stub]) {
        BasicObject.prototype[stub] = true;
        add_stub_for(BasicObject.prototype, stub);
      }
    }
  };

  /*
   * Actuall add a method_missing stub function to the given prototype for the
   * given name.
   *
   * @param [Prototype] prototype the target prototype
   * @param [String] stub stub name to add (e.g. "opal$foo")
   */
  function add_stub_for(prototype, stub) {
    function method_missing_stub() {
      // Copy any given block onto the method_missing dispatcher
      this.opal$method_missing._p = method_missing_stub._p;

      // Set block property to null ready for the next call (stop false-positives)
      method_missing_stub._p = null;

      // call method missing with correct args (remove 'opal$' prefix on method name)
      return this.opal$method_missing.apply(this, [stub.slice(1)].concat(opal$slice.call(arguments)));
    }

    method_missing_stub.rb_stub = true;
    prototype[stub] = method_missing_stub;
  }

  // Expose for other parts of Opal to use
  Opal.add_stub_for = add_stub_for;

  // Const missing dispatcher
  Opal.cm = function(name) {
    return this.base.opal$const_missing(name);
  };

  // Arity count error dispatcher
  Opal.ac = function(actual, expected, object, meth) {
    var inspect = (object._isClass ? object._name + '.' : object._klass._name + '#') + meth;
    var msg = '[' + inspect + '] wrong number of arguments(' + actual + ' for ' + expected + ')';
    throw Opal.ArgumentError.opal$new(msg);
  };

  // Super dispatcher
  Opal.find_super_dispatcher = function(obj, jsid, current_func, iter, defs) {
    var dispatcher;

    if (defs) {
      dispatcher = obj._isClass ? defs._super : obj._klass._proto;
    }
    else {
      if (obj._isClass) {
        dispatcher = obj._super;
      }
      else {
        dispatcher = find_obj_super_dispatcher(obj, jsid, current_func);
      }
    }

    dispatcher = dispatcher['opal$' + jsid];
    dispatcher._p = iter;

    return dispatcher;
  };

  // Iter dispatcher for super in a block
  Opal.find_iter_super_dispatcher = function(obj, jsid, current_func, iter, defs) {
    if (current_func._def) {
      return Opal.find_super_dispatcher(obj, current_func._jsid, current_func, iter, defs);
    }
    else {
      return Opal.find_super_dispatcher(obj, jsid, current_func, iter, defs);
    }
  };

  var find_obj_super_dispatcher = function(obj, jsid, current_func) {
    var klass = obj.__meta__ || obj._klass;

    while (klass) {
      if (klass._proto['opal$' + jsid] === current_func) {
        // ok
        break;
      }

      klass = klass.__parent;
    }

    // if we arent in a class, we couldnt find current?
    if (!klass) {
      throw new Error("could not find current class for super()");
    }

    klass = klass.__parent;

    // else, let's find the next one
    while (klass) {
      var working = klass._proto['opal$' + jsid];

      if (working && working !== current_func) {
        // ok
        break;
      }

      klass = klass.__parent;
    }

    return klass._proto;
  };

  /*
   * Used to return as an expression. Sometimes, we can't simply return from
   * a javascript function as if we were a method, as the return is used as
   * an expression, or even inside a block which must "return" to the outer
   * method. This helper simply throws an error which is then caught by the
   * method. This approach is expensive, so it is only used when absolutely
   * needed.
   */
  Opal.opal$return = function(val) {
    Opal.returner.opal$v = val;
    throw Opal.returner;
  };

  // handles yield calls for 1 yielded arg
  Opal.opal$yield1 = function(block, arg) {
    if (typeof(block) !== "function") {
      throw Opal.LocalJumpError.opal$new("no block given");
    }

    if (block.length > 1) {
      if (arg._isArray) {
        return block.apply(null, arg);
      }
      else {
        return block(arg);
      }
    }
    else {
      return block(arg);
    }
  };

  // handles yield for > 1 yielded arg
  Opal.opal$yieldX = function(block, args) {
    if (typeof(block) !== "function") {
      throw Opal.LocalJumpError.opal$new("no block given");
    }

    if (block.length > 1 && args.length == 1) {
      if (args[0]._isArray) {
        return block.apply(null, args[0]);
      }
    }

    if (!args._isArray) {
      args = opal$slice.call(args);
    }

    return block.apply(null, args);
  };

  // Finds the corresponding exception match in candidates.  Each candidate can
  // be a value, or an array of values.  Returns null if not found.
  Opal.opal$rescue = function(exception, candidates) {
    for (var i = 0; i != candidates.length; i++) {
      var candidate = candidates[i];
      if (candidate._isArray) {
        var subresult;
        if (subresult = Opal.opal$rescue(exception, candidate)) {
          return subresult;
        }
      }
      else if (candidate['opal$==='](exception)) {
        return candidate;
      }
    }
    return null;
  };

  Opal.is_a = function(object, klass) {
    if (object.__meta__ === klass) {
      return true;
    }

    var search = object._klass;

    while (search) {
      if (search === klass) {
        return true;
      }

      for (var i = 0, length = search.__inc__.length; i < length; i++) {
        if (search.__inc__[i] == klass) {
          return true;
        }
      }

      search = search._super;
    }

    return false;
  }

  // Helper to convert the given object to an array
  Opal.to_ary = function(value) {
    if (value._isArray) {
      return value;
    }
    else if (value.opal$to_ary && !value.opal$to_ary.rb_stub) {
      return value.opal$to_ary();
    }

    return [value];
  };

  /*
    Call a ruby method on a ruby object with some arguments:

      var my_array = [1, 2, 3, 4]
      Opal.send(my_array, 'length')     # => 4
      Opal.send(my_array, 'reverse!')   # => [4, 3, 2, 1]

    A missing method will be forwarded to the object via
    method_missing.

    The result of either call with be returned.

    @param [Object] recv the ruby object
    @param [String] mid ruby method to call
  */
  Opal.send = function(recv, mid) {
    var args = opal$slice.call(arguments, 2),
        func = recv['opal$' + mid];

    if (func) {
      return func.apply(recv, args);
    }

    return recv.opal$method_missing.apply(recv, [mid].concat(args));
  };

  Opal.block_send = function(recv, mid, block) {
    var args = opal$slice.call(arguments, 3),
        func = recv['opal$' + mid];

    if (func) {
      func._p = block;
      return func.apply(recv, args);
    }

    return recv.opal$method_missing.apply(recv, [mid].concat(args));
  };

  /**
   * Donate methods for a class/module
   */
  Opal.donate = function(klass, defined, indirect) {
    var methods = klass._methods, included_in = klass.__dep__;

    // if (!indirect) {
      klass._methods = methods.concat(defined);
    // }

    if (included_in) {
      for (var i = 0, length = included_in.length; i < length; i++) {
        var includee = included_in[i];
        var dest = includee._proto;

        for (var j = 0, jj = defined.length; j < jj; j++) {
          var method = defined[j];
          dest[method] = klass._proto[method];
          dest[method]._donated = true;
        }

        if (includee.__dep__) {
          Opal.donate(includee, defined, true);
        }
      }
    }
  };

  Opal.defn = function(obj, jsid, body) {
    if (obj.__mod__) {
      obj._proto[jsid] = body;
      Opal.donate(obj, [jsid]);
    }
    else if (obj._isClass) {
      obj._proto[jsid] = body;

      if (obj === RubyBasicObject) {
        define_basic_object_method(jsid, body);
      }
      else if (obj === RubyObject) {
        Opal.donate(obj, [jsid]);
      }
    }
    else {
      obj[jsid] = body;
    }

    return nil;
  };

  /*
   * Define a singleton method on the given object.
   */
  Opal.defs = function(obj, jsid, body) {
    if (obj._isClass || obj.__mod__) {
      obj.constructor.prototype[jsid] = body;
    }
    else {
      obj[jsid] = body;
    }
  };

  function define_basic_object_method(jsid, body) {
    RubyBasicObject._methods.push(jsid);
    for (var i = 0, len = bridged_classes.length; i < len; i++) {
      bridged_classes[i]._proto[jsid] = body;
    }
  }

  Opal.hash = function() {
    if (arguments.length == 1 && arguments[0]._klass == Opal.Hash) {
      return arguments[0];
    }

    var hash   = new Opal.Hash._alloc,
        keys   = [],
        assocs = {};

    hash.map   = assocs;
    hash.keys  = keys;

    if (arguments.length == 1) {
      if (arguments[0]._isArray) {
        var args = arguments[0];

        for (var i = 0, length = args.length; i < length; i++) {
          var pair = args[i];

          if (pair.length !== 2) {
            throw Opal.ArgumentError.opal$new("value not of length 2: " + pair.opal$inspect());
          }

          var key = pair[0],
              obj = pair[1];

          if (assocs[key] == null) {
            keys.push(key);
          }

          assocs[key] = obj;
        }
      }
      else {
        var obj = arguments[0];
        for (var key in obj) {
          assocs[key] = obj[key];
          keys.push(key);
        }
      }
    }
    else {
      var length = arguments.length;
      if (length % 2 !== 0) {
        throw Opal.ArgumentError.opal$new("odd number of arguments for Hash");
      }

      for (var i = 0; i < length; i++) {
        var key = arguments[i],
            obj = arguments[++i];

        if (assocs[key] == null) {
          keys.push(key);
        }

        assocs[key] = obj;
      }
    }

    return hash;
  };

  /*
   * hash2 is a faster creator for hashes that just use symbols and
   * strings as keys. The map and keys array can be constructed at
   * compile time, so they are just added here by the constructor
   * function
   */
  Opal.hash2 = function(keys, map) {
    var hash = new Opal.Hash._alloc;

    hash.keys = keys;
    hash.map  = map;

    return hash;
  };

  /*
   * Create a new range instance with first and last values, and whether the
   * range excludes the last value.
   */
  Opal.range = function(first, last, exc) {
    var range         = new Opal.Range._alloc;
        range.begin   = first;
        range.end     = last;
        range.exclude = exc;

    return range;
  };

  // Initialization
  // --------------

  // Constructors for *instances* of core objects
  boot_defclass('BasicObject', BasicObject);
  boot_defclass('Object', Object, BasicObject);
  boot_defclass('Module', Module, Object);
  boot_defclass('Class', Class, Module);

  // Constructors for *classes* of core objects
  RubyBasicObject = boot_makemeta('BasicObject', BasicObject, Class);
  RubyObject      = boot_makemeta('Object', Object, RubyBasicObject.constructor);
  RubyModule      = boot_makemeta('Module', Module, RubyObject.constructor);
  RubyClass       = boot_makemeta('Class', Class, RubyModule.constructor);

  // Fix booted classes to use their metaclass
  RubyBasicObject._klass = RubyClass;
  RubyObject._klass = RubyClass;
  RubyModule._klass = RubyClass;
  RubyClass._klass = RubyClass;

  // Fix superclasses of booted classes
  RubyBasicObject._super = null;
  RubyObject._super = RubyBasicObject;
  RubyModule._super = RubyObject;
  RubyClass._super = RubyModule;

  // Internally, Object acts like a module as it is "included" into bridged
  // classes. In other words, we donate methods from Object into our bridged
  // classes as their prototypes don't inherit from our root Object, so they
  // act like module includes.
  RubyObject.__dep__ = bridged_classes;

  Opal.base = RubyObject;
  RubyBasicObject._scope = RubyObject._scope = Opal;
  RubyBasicObject._orig_scope = RubyObject._orig_scope = Opal;
  Opal.Kernel = RubyObject;

  RubyModule._scope = RubyObject._scope;
  RubyClass._scope = RubyObject._scope;
  RubyModule._orig_scope = RubyObject._orig_scope;
  RubyClass._orig_scope = RubyObject._orig_scope;

  RubyObject._proto.toString = function() {
    return this.opal$to_s();
  };

  Opal.top = new RubyObject._alloc();

  Opal.klass(RubyObject, RubyObject, 'NilClass', NilClass);

  var nil = Opal.nil = new NilClass;
  nil.call = nil.apply = function() { throw Opal.LocalJumpError.opal$new('no block given'); };

  Opal.breaker  = new Error('unexpected break');
  Opal.returner = new Error('unexpected return');

  bridge_class('Array', Array);
  bridge_class('Boolean', Boolean);
  bridge_class('Numeric', Number);
  bridge_class('String', String);
  bridge_class('Proc', Function);
  bridge_class('Exception', Error);
  bridge_class('Regexp', RegExp);
  bridge_class('Time', Date);

  TypeError._super = Error;
}).call(this);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$module = opal$opal.module;

  return (function(opal$base) {
    var self = opal$module(opal$base, 'Opal');

    var def = self._proto, opal$scope = self._scope;

    opal$opal.defs(self, 'opal$type_error', function(object, type, method, coerced) {
      var opal$a, opal$b, self = this;

      if (method == null) {
        method = nil
      }
      if (coerced == null) {
        coerced = nil
      }
      if (((opal$a = ((opal$b = method !== false && method !== nil) ? coerced : opal$b)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return opal$scope.TypeError.opal$new("can't convert " + (object.opal$class()) + " into " + (type) + " (" + (object.opal$class()) + "#" + (method) + " gives " + (coerced.opal$class()))
        } else {
        return opal$scope.TypeError.opal$new("no implicit conversion of " + (object.opal$class()) + " into " + (type))
      };
    });

    opal$opal.defs(self, 'opal$coerce_to', function(object, type, method) {
      var opal$a, self = this;

      if (((opal$a = type['opal$==='](object)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return object};
      if (((opal$a = object['opal$respond_to?'](method)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(self.opal$type_error(object, type))
      };
      return object.opal$__send__(method);
    });

    opal$opal.defs(self, 'opal$coerce_to!', function(object, type, method) {
      var opal$a, self = this, coerced = nil;

      coerced = self.opal$coerce_to(object, type, method);
      if (((opal$a = type['opal$==='](coerced)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(self.opal$type_error(object, type, method, coerced))
      };
      return coerced;
    });

    opal$opal.defs(self, 'opal$coerce_to?', function(object, type, method) {
      var opal$a, self = this, coerced = nil;

      if (((opal$a = object['opal$respond_to?'](method)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        return nil
      };
      coerced = self.opal$coerce_to(object, type, method);
      if (((opal$a = coerced['opal$nil?']()) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return nil};
      if (((opal$a = type['opal$==='](coerced)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(self.opal$type_error(object, type, method, coerced))
      };
      return coerced;
    });

    opal$opal.defs(self, 'opal$try_convert', function(object, type, method) {
      var opal$a, self = this;

      if (((opal$a = type['opal$==='](object)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return object};
      if (((opal$a = object['opal$respond_to?'](method)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return object.opal$__send__(method)
        } else {
        return nil
      };
    });

    opal$opal.defs(self, 'opal$compare', function(a, b) {
      var opal$a, self = this, compare = nil;

      compare = a['opal$<=>'](b);
      if (((opal$a = compare === nil) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.ArgumentError, "comparison of " + (a.opal$class().opal$name()) + " with " + (b.opal$class().opal$name()) + " failed")};
      return compare;
    });

    opal$opal.defs(self, 'opal$destructure', function(args) {
      var self = this;

      
      if (args.length == 1) {
        return args[0];
      }
      else if (args._isArray) {
        return args;
      }
      else {
        return opal$slice.call(args);
      }
    
    });

    opal$opal.defs(self, 'opal$respond_to?', function(obj, method) {
      var self = this;

      
      if (obj == null || !obj._klass) {
        return false;
      }
    
      return obj['opal$respond_to?'](method);
    });

    opal$opal.defs(self, 'opal$inspect', function(obj) {
      var self = this;

      
      if (obj === undefined) {
        return "undefined";
      }
      else if (obj === null) {
        return "null";
      }
      else if (!obj._klass) {
        return obj.toString();
      }
      else {
        return obj.opal$inspect();
      }
    
    });
    
  })(self)
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass;

  return (function(opal$base, opal$super) {
    function opal$Module(){};
    var self = opal$Module = opal$klass(opal$base, opal$super, 'Module', opal$Module);

    var def = self._proto, opal$scope = self._scope, TMP_1, TMP_2, TMP_3, TMP_4;

    opal$opal.defs(self, 'opal$new', TMP_1 = function() {
      var self = this, opal$iter = TMP_1._p, block = opal$iter || nil;

      TMP_1._p = null;
      
      function AnonModule(){}
      var klass     = Opal.boot(Opal.Module, AnonModule);
      klass._name   = nil;
      klass._klass  = Opal.Module;
      klass.__dep__ = []
      klass.__mod__ = true;
      klass._proto  = {};

      // inherit scope from parent
      opal$opal.create_scope(Opal.Module._scope, klass);

      if (block !== nil) {
        var block_self = block._s;
        block._s = null;
        block.call(klass);
        block._s = block_self;
      }

      return klass;
    
    });

    def['opal$==='] = function(object) {
      var opal$a, self = this;

      if (((opal$a = object == null) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return false};
      return opal$opal.is_a(object, self);
    };

    def['opal$<'] = function(other) {
      var self = this;

      
      var working = self;

      while (working) {
        if (working === other) {
          return true;
        }

        working = working.__parent;
      }

      return false;
    
    };

    def.opal$alias_method = function(newname, oldname) {
      var self = this;

      
      self._proto['opal$' + newname] = self._proto['opal$' + oldname];

      if (self._methods) {
        opal$opal.donate(self, ['opal$' + newname ])
      }
    
      return self;
    };

    def.opal$alias_native = function(mid, jsid) {
      var self = this;

      if (jsid == null) {
        jsid = mid
      }
      return self._proto['opal$' + mid] = self._proto[jsid];
    };

    def.opal$ancestors = function() {
      var self = this;

      
      var parent = self,
          result = [];

      while (parent) {
        result.push(parent);
        result = result.concat(parent.__inc__);

        parent = parent._super;
      }

      return result;
    
    };

    def.opal$append_features = function(klass) {
      var self = this;

      
      var module   = self,
          included = klass.__inc__;

      // check if this module is already included in the klass
      for (var i = 0, length = included.length; i < length; i++) {
        if (included[i] === module) {
          return;
        }
      }

      included.push(module);
      module.__dep__.push(klass);

      // iclass
      var iclass = {
        name: module._name,

        _proto:   module._proto,
        __parent: klass.__parent,
        __iclass: true
      };

      klass.__parent = iclass;

      var donator   = module._proto,
          prototype = klass._proto,
          methods   = module._methods;

      for (var i = 0, length = methods.length; i < length; i++) {
        var method = methods[i];

        if (prototype.hasOwnProperty(method) && !prototype[method]._donated) {
          // if the target class already has a method of the same name defined
          // and that method was NOT donated, then it must be a method defined
          // by the class so we do not want to override it
        }
        else {
          prototype[method] = donator[method];
          prototype[method]._donated = true;
        }
      }

      if (klass.__dep__) {
        opal$opal.donate(klass, methods.slice(), true);
      }

      opal$opal.donate_constants(module, klass);
    
      return self;
    };

    def.opal$attr_accessor = function(names) {
      var opal$a, opal$b, self = this;

      names = opal$slice.call(arguments, 0);
      (opal$a = self).opal$attr_reader.apply(opal$a, [].concat(names));
      return (opal$b = self).opal$attr_writer.apply(opal$b, [].concat(names));
    };

    def.opal$attr_reader = function(names) {
      var self = this;

      names = opal$slice.call(arguments, 0);
      
      var proto = self._proto, cls = self;
      for (var i = 0, length = names.length; i < length; i++) {
        (function(name) {
          proto[name] = nil;
          var func = function() { return this[name] };

          if (cls._isSingleton) {
            proto.constructor.prototype['opal$' + name] = func;
          }
          else {
            proto['opal$' + name] = func;
            opal$opal.donate(self, ['opal$' + name ]);
          }
        })(names[i]);
      }
    
      return nil;
    };

    def.opal$attr_writer = function(names) {
      var self = this;

      names = opal$slice.call(arguments, 0);
      
      var proto = self._proto, cls = self;
      for (var i = 0, length = names.length; i < length; i++) {
        (function(name) {
          proto[name] = nil;
          var func = function(value) { return this[name] = value; };

          if (cls._isSingleton) {
            proto.constructor.prototype['opal$' + name + '='] = func;
          }
          else {
            proto['opal$' + name + '='] = func;
            opal$opal.donate(self, ['opal$' + name + '=']);
          }
        })(names[i]);
      }
    
      return nil;
    };

    opal$opal.defn(self, 'opal$attr', def.opal$attr_accessor);

    def.opal$constants = function() {
      var self = this;

      return self._scope.constants;
    };

    def['opal$const_defined?'] = function(name, inherit) {
      var opal$a, self = this;

      if (inherit == null) {
        inherit = true
      }
      if (((opal$a = name['opal$=~'](/^[A-Z]\w*$/)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.NameError, "wrong constant name " + (name))
      };
      
      scopes = [self._scope];
      if (inherit || self === Opal.Object) {
        var parent = self._super;
        while (parent !== Opal.BasicObject) {
          scopes.push(parent._scope);
          parent = parent._super;
        }
      }

      for (var i = 0, len = scopes.length; i < len; i++) {
        if (scopes[i].hasOwnProperty(name)) {
          return true;
        }
      }

      return false;
    
    };

    def.opal$const_get = function(name, inherit) {
      var opal$a, self = this;

      if (inherit == null) {
        inherit = true
      }
      if (((opal$a = name['opal$=~'](/^[A-Z]\w*$/)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.NameError, "wrong constant name " + (name))
      };
      
      var scopes = [self._scope];
      if (inherit || self == Opal.Object) {
        var parent = self._super;
        while (parent !== Opal.BasicObject) {
          scopes.push(parent._scope);
          parent = parent._super;
        }
      }

      for (var i = 0, len = scopes.length; i < len; i++) {
        if (scopes[i].hasOwnProperty(name)) {
          return scopes[i][name];
        }
      }

      return self.opal$const_missing(name);
    
    };

    def.opal$const_missing = function(constopal$) {
      var self = this, name = nil;

      name = self._name;
      return self.opal$raise(opal$scope.NameError, "uninitialized constant " + (name) + "::" + (constopal$));
    };

    def.opal$const_set = function(name, value) {
      var opal$a, self = this;

      if (((opal$a = name['opal$=~'](/^[A-Z]\w*/)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.NameError, "wrong constant name " + (name))
      };
      try {
      name = name.opal$to_str()
      } catch (opal$err) {if (true) {
        self.opal$raise(opal$scope.TypeError, "conversion with #to_str failed")
        }else { throw opal$err; }
      };
      
      opal$opal.casgn(self, name, value);
      return value
    ;
    };

    def.opal$define_method = TMP_2 = function(name, method) {
      var self = this, opal$iter = TMP_2._p, block = opal$iter || nil;

      TMP_2._p = null;
      
      if (method) {
        block = method.opal$to_proc();
      }

      if (block === nil) {
        throw new Error("no block given");
      }

      var jsid    = 'opal$' + name;
      block._jsid = name;
      block._s    = null;
      block._def  = block;

      self._proto[jsid] = block;
      opal$opal.donate(self, [jsid]);

      return name;
    ;
    };

    def.opal$remove_method = function(name) {
      var self = this;

      
      var jsid    = 'opal$' + name;
      var current = self._proto[jsid];
      delete self._proto[jsid];

      // Check if we need to reverse opal$opal.donate
      // opal$opal.retire(self, [jsid]);
      return self;
    
    };

    def.opal$include = function(mods) {
      var self = this;

      mods = opal$slice.call(arguments, 0);
      
      for (var i = mods.length - 1; i >= 0; i--) {
        var mod = mods[i];

        if (mod === self) {
          continue;
        }

        (mod).opal$append_features(self);
        (mod).opal$included(self);
      }
    
      return self;
    };

    def['opal$include?'] = function(mod) {
      var self = this;

      
      for (var cls = self; cls; cls = cls.parent) {
        for (var i = 0; i != cls.__inc__.length; i++) {
          var mod2 = cls.__inc__[i];
          if (mod === mod2) {
            return true;
          }
        }
      }
      return false;
    
    };

    def.opal$instance_method = function(name) {
      var self = this;

      
      var meth = self._proto['opal$' + name];

      if (!meth || meth.rb_stub) {
        self.opal$raise(opal$scope.NameError, "undefined method `" + (name) + "' for class `" + (self.opal$name()) + "'");
      }

      return opal$scope.UnboundMethod.opal$new(self, meth, name);
    
    };

    def.opal$instance_methods = function(include_super) {
      var self = this;

      if (include_super == null) {
        include_super = false
      }
      
      var methods = [], proto = self._proto;

      for (var prop in self._proto) {
        if (!include_super && !proto.hasOwnProperty(prop)) {
          continue;
        }

        if (!include_super && proto[prop]._donated) {
          continue;
        }

        if (prop.charAt(0) === 'opal$') {
          methods.push(prop.substr(1));
        }
      }

      return methods;
    
    };

    def.opal$included = function(mod) {
      var self = this;

      return nil;
    };

    def.opal$extended = function(mod) {
      var self = this;

      return nil;
    };

    def.opal$module_eval = TMP_3 = function() {
      var self = this, opal$iter = TMP_3._p, block = opal$iter || nil;

      TMP_3._p = null;
      if (block !== false && block !== nil) {
        } else {
        self.opal$raise(opal$scope.ArgumentError, "no block given")
      };
      
      var old = block._s,
          result;

      block._s = null;
      result = block.call(self);
      block._s = old;

      return result;
    
    };

    opal$opal.defn(self, 'opal$class_eval', def.opal$module_eval);

    def.opal$module_exec = TMP_4 = function() {
      var self = this, opal$iter = TMP_4._p, block = opal$iter || nil;

      TMP_4._p = null;
      
      if (block === nil) {
        throw new Error("no block given");
      }

      var block_self = block._s, result;

      block._s = null;
      result = block.apply(self, opal$slice.call(arguments));
      block._s = block_self;

      return result;
    
    };

    opal$opal.defn(self, 'opal$class_exec', def.opal$module_exec);

    def['opal$method_defined?'] = function(method) {
      var self = this;

      
      var body = self._proto['opal$' + method];
      return (!!body) && !body.rb_stub;
    
    };

    def.opal$module_function = function(methods) {
      var self = this;

      methods = opal$slice.call(arguments, 0);
      
      for (var i = 0, length = methods.length; i < length; i++) {
        var meth = methods[i], func = self._proto['opal$' + meth];

        self.constructor.prototype['opal$' + meth] = func;
      }

      return self;
    
    };

    def.opal$name = function() {
      var self = this;

      
      if (self._full_name) {
        return self._full_name;
      }

      var result = [], base = self;

      while (base) {
        if (base._name === nil) {
          return result.length === 0 ? nil : result.join('::');
        }

        result.unshift(base._name);

        base = base._base_module;

        if (base === opal$opal.Object) {
          break;
        }
      }

      if (result.length === 0) {
        return nil;
      }

      return self._full_name = result.join('::');
    
    };

    def.opal$public = function() {
      var self = this;

      return nil;
    };

    def.opal$private_class_method = function(name) {
      var self = this;

      return self['opal$' + name] || nil;
    };

    opal$opal.defn(self, 'opal$private', def.opal$public);

    opal$opal.defn(self, 'opal$protected', def.opal$public);

    def['opal$private_method_defined?'] = function(obj) {
      var self = this;

      return false;
    };

    def.opal$private_constant = function() {
      var self = this;

      return nil;
    };

    opal$opal.defn(self, 'opal$protected_method_defined?', def['opal$private_method_defined?']);

    opal$opal.defn(self, 'opal$public_instance_methods', def.opal$instance_methods);

    opal$opal.defn(self, 'opal$public_method_defined?', def['opal$method_defined?']);

    def.opal$remove_class_variable = function() {
      var self = this;

      return nil;
    };

    def.opal$remove_const = function(name) {
      var self = this;

      
      var old = self._scope[name];
      delete self._scope[name];
      return old;
    
    };

    def.opal$to_s = function() {
      var self = this;

      return self.opal$name().opal$to_s();
    };

    return (def.opal$undef_method = function(symbol) {
      var self = this;

      opal$opal.add_stub_for(self._proto, "opal$" + symbol);
      return self;
    }, nil) && 'undef_method';
  })(self, null)
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass;

  ;
  return (function(opal$base, opal$super) {
    function opal$Class(){};
    var self = opal$Class = opal$klass(opal$base, opal$super, 'Class', opal$Class);

    var def = self._proto, opal$scope = self._scope, TMP_1, TMP_2;

    opal$opal.defs(self, 'opal$new', TMP_1 = function(sup) {
      var self = this, opal$iter = TMP_1._p, block = opal$iter || nil;

      if (sup == null) {
        sup = opal$scope.Object
      }
      TMP_1._p = null;
      
      if (!sup._isClass || sup.__mod__) {
        self.opal$raise(opal$scope.TypeError, "superclass must be a Class");
      }

      function AnonClass(){};
      var klass       = Opal.boot(sup, AnonClass)
      klass._name     = nil;
      klass.__parent  = sup;

      // inherit scope from parent
      opal$opal.create_scope(sup._scope, klass);

      sup.opal$inherited(klass);

      if (block !== nil) {
        var block_self = block._s;
        block._s = null;
        block.call(klass);
        block._s = block_self;
      }

      return klass;
    ;
    });

    def.opal$allocate = function() {
      var self = this;

      
      var obj = new self._alloc;
      obj._id = Opal.uid();
      return obj;
    
    };

    def.opal$inherited = function(cls) {
      var self = this;

      return nil;
    };

    def.opal$new = TMP_2 = function(args) {
      var self = this, opal$iter = TMP_2._p, block = opal$iter || nil;

      args = opal$slice.call(arguments, 0);
      TMP_2._p = null;
      
      var obj = self.opal$allocate();

      obj.opal$initialize._p = block;
      obj.opal$initialize.apply(obj, args);
      return obj;
    ;
    };

    return (def.opal$superclass = function() {
      var self = this;

      return self._super || nil;
    }, nil) && 'superclass';
  })(self, null);
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass;

  return (function(opal$base, opal$super) {
    function opal$BasicObject(){};
    var self = opal$BasicObject = opal$klass(opal$base, opal$super, 'BasicObject', opal$BasicObject);

    var def = self._proto, opal$scope = self._scope, TMP_1, TMP_2, TMP_3, TMP_4;

    opal$opal.defn(self, 'opal$initialize', function() {
      var self = this;

      return nil;
    });

    opal$opal.defn(self, 'opal$==', function(other) {
      var self = this;

      return self === other;
    });

    opal$opal.defn(self, 'opal$__id__', function() {
      var self = this;

      return self._id || (self._id = Opal.uid());
    });

    opal$opal.defn(self, 'opal$__send__', TMP_1 = function(symbol, args) {
      var self = this, opal$iter = TMP_1._p, block = opal$iter || nil;

      args = opal$slice.call(arguments, 1);
      TMP_1._p = null;
      
      var func = self['opal$' + symbol]

      if (func) {
        if (block !== nil) {
          func._p = block;
        }

        return func.apply(self, args);
      }

      if (block !== nil) {
        self.opal$method_missing._p = block;
      }

      return self.opal$method_missing.apply(self, [symbol].concat(args));
    
    });

    opal$opal.defn(self, 'opal$!', function() {
      var self = this;

      return false;
    });

    opal$opal.defn(self, 'opal$eql?', def['opal$==']);

    opal$opal.defn(self, 'opal$equal?', def['opal$==']);

    opal$opal.defn(self, 'opal$instance_eval', TMP_2 = function() {
      var self = this, opal$iter = TMP_2._p, block = opal$iter || nil;

      TMP_2._p = null;
      if (block !== false && block !== nil) {
        } else {
        opal$scope.Kernel.opal$raise(opal$scope.ArgumentError, "no block given")
      };
      
      var old = block._s,
          result;

      block._s = null;
      result = block.call(self, self);
      block._s = old;

      return result;
    
    });

    opal$opal.defn(self, 'opal$instance_exec', TMP_3 = function(args) {
      var self = this, opal$iter = TMP_3._p, block = opal$iter || nil;

      args = opal$slice.call(arguments, 0);
      TMP_3._p = null;
      if (block !== false && block !== nil) {
        } else {
        opal$scope.Kernel.opal$raise(opal$scope.ArgumentError, "no block given")
      };
      
      var block_self = block._s,
          result;

      block._s = null;
      result = block.apply(self, args);
      block._s = block_self;

      return result;
    
    });

    return (opal$opal.defn(self, 'opal$method_missing', TMP_4 = function(symbol, args) {
      var self = this, opal$iter = TMP_4._p, block = opal$iter || nil;

      args = opal$slice.call(arguments, 1);
      TMP_4._p = null;
      return opal$scope.Kernel.opal$raise(opal$scope.NoMethodError, "undefined method `" + (symbol) + "' for BasicObject instance");
    }), nil) && 'method_missing';
  })(self, null)
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$module = opal$opal.module, opal$gvars = opal$opal.gvars;

  return (function(opal$base) {
    var self = opal$module(opal$base, 'Kernel');

    var def = self._proto, opal$scope = self._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_7, TMP_9;

    def.opal$method_missing = TMP_1 = function(symbol, args) {
      var self = this, opal$iter = TMP_1._p, block = opal$iter || nil;

      args = opal$slice.call(arguments, 1);
      TMP_1._p = null;
      return self.opal$raise(opal$scope.NoMethodError, "undefined method `" + (symbol) + "' for " + (self.opal$inspect()));
    };

    def['opal$=~'] = function(obj) {
      var self = this;

      return false;
    };

    def['opal$==='] = function(other) {
      var self = this;

      return self['opal$=='](other);
    };

    def['opal$<=>'] = function(other) {
      var self = this;

      
      if (self['opal$=='](other)) {
        return 0;
      }

      return nil;
    ;
    };

    def.opal$method = function(name) {
      var self = this;

      
      var meth = self['opal$' + name];

      if (!meth || meth.rb_stub) {
        self.opal$raise(opal$scope.NameError, "undefined method `" + (name) + "' for class `" + (self.opal$class().opal$name()) + "'");
      }

      return opal$scope.Method.opal$new(self, meth, name);
    
    };

    def.opal$methods = function(all) {
      var self = this;

      if (all == null) {
        all = true
      }
      
      var methods = [];

      for (var key in self) {
        if (key[0] == "opal$" && typeof(self[key]) === "function") {
          if (all == false || all === nil) {
            if (!opal$opal.hasOwnProperty.call(self, key)) {
              continue;
            }
          }
          if (self[key].rb_stub === undefined) {
            methods.push(key.substr(1));
          }
        }
      }

      return methods;
    
    };

    def.opal$Array = TMP_2 = function(object, args) {
      var self = this, opal$iter = TMP_2._p, block = opal$iter || nil;

      args = opal$slice.call(arguments, 1);
      TMP_2._p = null;
      
      if (object == null || object === nil) {
        return [];
      }
      else if (object['opal$respond_to?']("to_ary")) {
        return object.opal$to_ary();
      }
      else if (object['opal$respond_to?']("to_a")) {
        return object.opal$to_a();
      }
      else {
        return [object];
      }
    ;
    };

    def.opal$caller = function() {
      var self = this;

      return [];
    };

    def.opal$class = function() {
      var self = this;

      return self._klass;
    };

    def.opal$copy_instance_variables = function(other) {
      var self = this;

      
      for (var name in other) {
        if (name.charAt(0) !== 'opal$') {
          if (name !== '_id' && name !== '_klass') {
            self[name] = other[name];
          }
        }
      }
    
    };

    def.opal$clone = function() {
      var self = this, copy = nil;

      copy = self.opal$class().opal$allocate();
      copy.opal$copy_instance_variables(self);
      copy.opal$initialize_clone(self);
      return copy;
    };

    def.opal$initialize_clone = function(other) {
      var self = this;

      return self.opal$initialize_copy(other);
    };

    def.opal$define_singleton_method = TMP_3 = function(name) {
      var self = this, opal$iter = TMP_3._p, body = opal$iter || nil;

      TMP_3._p = null;
      if (body !== false && body !== nil) {
        } else {
        self.opal$raise(opal$scope.ArgumentError, "tried to create Proc object without a block")
      };
      
      var jsid   = 'opal$' + name;
      body._jsid = name;
      body._s    = null;
      body._def  = body;

      self.opal$singleton_class()._proto[jsid] = body;

      return self;
    
    };

    def.opal$dup = function() {
      var self = this, copy = nil;

      copy = self.opal$class().opal$allocate();
      copy.opal$copy_instance_variables(self);
      copy.opal$initialize_dup(self);
      return copy;
    };

    def.opal$initialize_dup = function(other) {
      var self = this;

      return self.opal$initialize_copy(other);
    };

    def.opal$enum_for = TMP_4 = function(method, args) {
      var opal$a, opal$b, self = this, opal$iter = TMP_4._p, block = opal$iter || nil;

      args = opal$slice.call(arguments, 1);
      if (method == null) {
        method = "each"
      }
      TMP_4._p = null;
      return (opal$a = (opal$b = opal$scope.Enumerator).opal$for, opal$a._p = block.opal$to_proc(), opal$a).apply(opal$b, [self, method].concat(args));
    };

    opal$opal.defn(self, 'opal$to_enum', def.opal$enum_for);

    def['opal$equal?'] = function(other) {
      var self = this;

      return self === other;
    };

    def.opal$extend = function(mods) {
      var self = this;

      mods = opal$slice.call(arguments, 0);
      
      var singleton = self.opal$singleton_class();

      for (var i = mods.length - 1; i >= 0; i--) {
        var mod = mods[i];

        (mod).opal$append_features(singleton);
        (mod).opal$extended(self);
      }
    ;
      return self;
    };

    def.opal$format = function(format, args) {
      var self = this;

      args = opal$slice.call(arguments, 1);
      
      var idx = 0;
      return format.replace(/%(\d+\opal$)?([-+ 0]*)(\d*|\*(\d+\opal$)?)(?:\.(\d*|\*(\d+\opal$)?))?([cspdiubBoxXfgeEG])|(%%)/g, function(str, idx_str, flags, width_str, w_idx_str, prec_str, p_idx_str, spec, escaped) {
        if (escaped) {
          return '%';
        }

        var width,
        prec,
        is_integer_spec = ("diubBoxX".indexOf(spec) != -1),
        is_float_spec = ("eEfgG".indexOf(spec) != -1),
        prefix = '',
        obj;

        if (width_str === undefined) {
          width = undefined;
        } else if (width_str.charAt(0) == '*') {
          var w_idx = idx++;
          if (w_idx_str) {
            w_idx = parseInt(w_idx_str, 10) - 1;
          }
          width = (args[w_idx]).opal$to_i();
        } else {
          width = parseInt(width_str, 10);
        }
        if (!prec_str) {
          prec = is_float_spec ? 6 : undefined;
        } else if (prec_str.charAt(0) == '*') {
          var p_idx = idx++;
          if (p_idx_str) {
            p_idx = parseInt(p_idx_str, 10) - 1;
          }
          prec = (args[p_idx]).opal$to_i();
        } else {
          prec = parseInt(prec_str, 10);
        }
        if (idx_str) {
          idx = parseInt(idx_str, 10) - 1;
        }
        switch (spec) {
        case 'c':
          obj = args[idx];
          if (obj._isString) {
            str = obj.charAt(0);
          } else {
            str = String.fromCharCode((obj).opal$to_i());
          }
          break;
        case 's':
          str = (args[idx]).opal$to_s();
          if (prec !== undefined) {
            str = str.substr(0, prec);
          }
          break;
        case 'p':
          str = (args[idx]).opal$inspect();
          if (prec !== undefined) {
            str = str.substr(0, prec);
          }
          break;
        case 'd':
        case 'i':
        case 'u':
          str = (args[idx]).opal$to_i().toString();
          break;
        case 'b':
        case 'B':
          str = (args[idx]).opal$to_i().toString(2);
          break;
        case 'o':
          str = (args[idx]).opal$to_i().toString(8);
          break;
        case 'x':
        case 'X':
          str = (args[idx]).opal$to_i().toString(16);
          break;
        case 'e':
        case 'E':
          str = (args[idx]).opal$to_f().toExponential(prec);
          break;
        case 'f':
          str = (args[idx]).opal$to_f().toFixed(prec);
          break;
        case 'g':
        case 'G':
          str = (args[idx]).opal$to_f().toPrecision(prec);
          break;
        }
        idx++;
        if (is_integer_spec || is_float_spec) {
          if (str.charAt(0) == '-') {
            prefix = '-';
            str = str.substr(1);
          } else {
            if (flags.indexOf('+') != -1) {
              prefix = '+';
            } else if (flags.indexOf(' ') != -1) {
              prefix = ' ';
            }
          }
        }
        if (is_integer_spec && prec !== undefined) {
          if (str.length < prec) {
            str = "0"['opal$*'](prec - str.length) + str;
          }
        }
        var total_len = prefix.length + str.length;
        if (width !== undefined && total_len < width) {
          if (flags.indexOf('-') != -1) {
            str = str + " "['opal$*'](width - total_len);
          } else {
            var pad_char = ' ';
            if (flags.indexOf('0') != -1) {
              str = "0"['opal$*'](width - total_len) + str;
            } else {
              prefix = " "['opal$*'](width - total_len) + prefix;
            }
          }
        }
        var result = prefix + str;
        if ('XEG'.indexOf(spec) != -1) {
          result = result.toUpperCase();
        }
        return result;
      });
    
    };

    def.opal$hash = function() {
      var self = this;

      return self._id;
    };

    def.opal$initialize_copy = function(other) {
      var self = this;

      return nil;
    };

    def.opal$inspect = function() {
      var self = this;

      return self.opal$to_s();
    };

    def['opal$instance_of?'] = function(klass) {
      var self = this;

      return self._klass === klass;
    };

    def['opal$instance_variable_defined?'] = function(name) {
      var self = this;

      return opal$opal.hasOwnProperty.call(self, name.substr(1));
    };

    def.opal$instance_variable_get = function(name) {
      var self = this;

      
      var ivar = self[name.substr(1)];

      return ivar == null ? nil : ivar;
    
    };

    def.opal$instance_variable_set = function(name, value) {
      var self = this;

      return self[name.substr(1)] = value;
    };

    def.opal$instance_variables = function() {
      var self = this;

      
      var result = [];

      for (var name in self) {
        if (name.charAt(0) !== 'opal$') {
          if (name !== '_klass' && name !== '_id') {
            result.push('@' + name);
          }
        }
      }

      return result;
    
    };

    def.opal$Integer = function(value, base) {
      var opal$a, opal$b, self = this, opal$case = nil;

      if (base == null) {
        base = nil
      }
      if (((opal$a = opal$scope.String['opal$==='](value)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        if (((opal$a = value['opal$empty?']()) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          self.opal$raise(opal$scope.ArgumentError, "invalid value for Integer: (empty string)")};
        return parseInt(value, (((opal$a = base) !== false && opal$a !== nil) ? opal$a : undefined));};
      if (base !== false && base !== nil) {
        self.opal$raise(self.opal$ArgumentError("base is only valid for String values"))};
      return (function() {opal$case = value;if (opal$scope.Integer['opal$==='](opal$case)) {return value}else if (opal$scope.Float['opal$==='](opal$case)) {if (((opal$a = (((opal$b = value['opal$nan?']()) !== false && opal$b !== nil) ? opal$b : value['opal$infinite?']())) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.FloatDomainError, "unable to coerce " + (value) + " to Integer")};
      return value.opal$to_int();}else if (opal$scope.NilClass['opal$==='](opal$case)) {return self.opal$raise(opal$scope.TypeError, "can't convert nil into Integer")}else {if (((opal$a = value['opal$respond_to?']("to_int")) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return value.opal$to_int()
      } else if (((opal$a = value['opal$respond_to?']("to_i")) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return value.opal$to_i()
        } else {
        return self.opal$raise(opal$scope.TypeError, "can't convert " + (value.opal$class()) + " into Integer")
      }}})();
    };

    def.opal$Float = function(value) {
      var opal$a, self = this;

      if (((opal$a = opal$scope.String['opal$==='](value)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return parseFloat(value);
      } else if (((opal$a = value['opal$respond_to?']("to_f")) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return value.opal$to_f()
        } else {
        return self.opal$raise(opal$scope.TypeError, "can't convert " + (value.opal$class()) + " into Float")
      };
    };

    def['opal$is_a?'] = function(klass) {
      var self = this;

      return opal$opal.is_a(self, klass);
    };

    opal$opal.defn(self, 'opal$kind_of?', def['opal$is_a?']);

    def.opal$lambda = TMP_5 = function() {
      var self = this, opal$iter = TMP_5._p, block = opal$iter || nil;

      TMP_5._p = null;
      block.is_lambda = true;
      return block;
    };

    def.opal$loop = TMP_6 = function() {
      var self = this, opal$iter = TMP_6._p, block = opal$iter || nil;

      TMP_6._p = null;
      
      while (true) {
        if (block() === opal$breaker) {
          return opal$breaker.opal$v;
        }
      }
    
      return self;
    };

    def['opal$nil?'] = function() {
      var self = this;

      return false;
    };

    opal$opal.defn(self, 'opal$object_id', def.opal$__id__);

    def.opal$printf = function(args) {
      var opal$a, self = this;

      args = opal$slice.call(arguments, 0);
      if (args.opal$length()['opal$>'](0)) {
        self.opal$print((opal$a = self).opal$format.apply(opal$a, [].concat(args)))};
      return nil;
    };

    def.opal$private_methods = function() {
      var self = this;

      return [];
    };

    def.opal$proc = TMP_7 = function() {
      var self = this, opal$iter = TMP_7._p, block = opal$iter || nil;

      TMP_7._p = null;
      if (block !== false && block !== nil) {
        } else {
        self.opal$raise(opal$scope.ArgumentError, "tried to create Proc object without a block")
      };
      block.is_lambda = false;
      return block;
    };

    def.opal$puts = function(strs) {
      var opal$a, self = this;
      if (opal$gvars.stdout == null) opal$gvars.stdout = nil;

      strs = opal$slice.call(arguments, 0);
      return (opal$a = opal$gvars.stdout).opal$puts.apply(opal$a, [].concat(strs));
    };

    def.opal$p = function(args) {
      var opal$a, opal$b, TMP_8, self = this;

      args = opal$slice.call(arguments, 0);
      (opal$a = (opal$b = args).opal$each, opal$a._p = (TMP_8 = function(obj){var self = TMP_8._s || this;
        if (opal$gvars.stdout == null) opal$gvars.stdout = nil;
if (obj == null) obj = nil;
      return opal$gvars.stdout.opal$puts(obj.opal$inspect())}, TMP_8._s = self, TMP_8), opal$a).call(opal$b);
      if (args.opal$length()['opal$<='](1)) {
        return args['opal$[]'](0)
        } else {
        return args
      };
    };

    def.opal$print = function(strs) {
      var opal$a, self = this;
      if (opal$gvars.stdout == null) opal$gvars.stdout = nil;

      strs = opal$slice.call(arguments, 0);
      return (opal$a = opal$gvars.stdout).opal$print.apply(opal$a, [].concat(strs));
    };

    def.opal$warn = function(strs) {
      var opal$a, opal$b, self = this;
      if (opal$gvars.VERBOSE == null) opal$gvars.VERBOSE = nil;
      if (opal$gvars.stderr == null) opal$gvars.stderr = nil;

      strs = opal$slice.call(arguments, 0);
      if (((opal$a = (((opal$b = opal$gvars.VERBOSE['opal$nil?']()) !== false && opal$b !== nil) ? opal$b : strs['opal$empty?']())) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        (opal$a = opal$gvars.stderr).opal$puts.apply(opal$a, [].concat(strs))
      };
      return nil;
    };

    def.opal$raise = function(exception, string) {
      var self = this;
      if (opal$gvars["!"] == null) opal$gvars["!"] = nil;

      
      if (exception == null && opal$gvars["!"]) {
        exception = opal$gvars["!"];
      }
      else if (exception._isString) {
        exception = opal$scope.RuntimeError.opal$new(exception);
      }
      else if (!exception['opal$is_a?'](opal$scope.Exception)) {
        exception = exception.opal$new(string);
      }

      opal$gvars["!"] = exception;
      throw exception;
    ;
    };

    opal$opal.defn(self, 'opal$fail', def.opal$raise);

    def.opal$rand = function(max) {
      var self = this;

      
      if (max === undefined) {
        return Math.random();
      }
      else if (max._isRange) {
        var arr = max.opal$to_a();

        return arr[self.opal$rand(arr.length)];
      }
      else {
        return Math.floor(Math.random() *
          Math.abs(opal$scope.Opal.opal$coerce_to(max, opal$scope.Integer, "to_int")));
      }
    
    };

    opal$opal.defn(self, 'opal$srand', def.opal$rand);

    def['opal$respond_to?'] = function(name, include_all) {
      var opal$a, self = this;

      if (include_all == null) {
        include_all = false
      }
      if (((opal$a = self['opal$respond_to_missing?'](name)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return true};
      
      var body = self['opal$' + name];

      if (typeof(body) === "function" && !body.rb_stub) {
        return true;
      }
    
      return false;
    };

    opal$opal.defn(self, 'opal$send', def.opal$__send__);

    opal$opal.defn(self, 'opal$public_send', def.opal$__send__);

    def.opal$singleton_class = function() {
      var self = this;

      
      if (self._isClass) {
        if (self.__meta__) {
          return self.__meta__;
        }

        var meta = new opal$opal.Class._alloc;
        meta._klass = opal$opal.Class;
        self.__meta__ = meta;
        // FIXME - is this right? (probably - methods defined on
        // class' singleton should also go to subclasses?)
        meta._proto = self.constructor.prototype;
        meta._isSingleton = true;
        meta.__inc__ = [];
        meta._methods = [];

        meta._scope = self._scope;

        return meta;
      }

      if (self._isClass) {
        return self._klass;
      }

      if (self.__meta__) {
        return self.__meta__;
      }

      else {
        var orig_class = self._klass,
            class_id   = "#<Class:#<" + orig_class._name + ":" + orig_class._id + ">>";

        var Singleton = function () {};
        var meta = Opal.boot(orig_class, Singleton);
        meta._name = class_id;

        meta._proto = self;
        self.__meta__ = meta;
        meta._klass = orig_class._klass;
        meta._scope = orig_class._scope;
        meta.__parent = orig_class;

        return meta;
      }
    
    };

    opal$opal.defn(self, 'opal$sprintf', def.opal$format);

    def.opal$String = function(str) {
      var self = this;

      return String(str);
    };

    def.opal$tap = TMP_9 = function() {
      var self = this, opal$iter = TMP_9._p, block = opal$iter || nil;

      TMP_9._p = null;
      if (opal$opal.opal$yield1(block, self) === opal$breaker) return opal$breaker.opal$v;
      return self;
    };

    def.opal$to_proc = function() {
      var self = this;

      return self;
    };

    def.opal$to_s = function() {
      var self = this;

      return "#<" + self.opal$class().opal$name() + ":" + self._id + ">";
    };

    def.opal$freeze = function() {
      var self = this;

      self.___frozen___ = true;
      return self;
    };

    def['opal$frozen?'] = function() {
      var opal$a, self = this;
      if (self.___frozen___ == null) self.___frozen___ = nil;

      return (((opal$a = self.___frozen___) !== false && opal$a !== nil) ? opal$a : false);
    };

    def['opal$respond_to_missing?'] = function(method_name) {
      var self = this;

      return false;
    };
        ;opal$opal.donate(self, ["opal$method_missing", "opal$=~", "opal$===", "opal$<=>", "opal$method", "opal$methods", "opal$Array", "opal$caller", "opal$class", "opal$copy_instance_variables", "opal$clone", "opal$initialize_clone", "opal$define_singleton_method", "opal$dup", "opal$initialize_dup", "opal$enum_for", "opal$to_enum", "opal$equal?", "opal$extend", "opal$format", "opal$hash", "opal$initialize_copy", "opal$inspect", "opal$instance_of?", "opal$instance_variable_defined?", "opal$instance_variable_get", "opal$instance_variable_set", "opal$instance_variables", "opal$Integer", "opal$Float", "opal$is_a?", "opal$kind_of?", "opal$lambda", "opal$loop", "opal$nil?", "opal$object_id", "opal$printf", "opal$private_methods", "opal$proc", "opal$puts", "opal$p", "opal$print", "opal$warn", "opal$raise", "opal$fail", "opal$rand", "opal$srand", "opal$respond_to?", "opal$send", "opal$public_send", "opal$singleton_class", "opal$sprintf", "opal$String", "opal$tap", "opal$to_proc", "opal$to_s", "opal$freeze", "opal$frozen?", "opal$respond_to_missing?"]);
  })(self)
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass;

  (function(opal$base, opal$super) {
    function opal$NilClass(){};
    var self = opal$NilClass = opal$klass(opal$base, opal$super, 'NilClass', opal$NilClass);

    var def = self._proto, opal$scope = self._scope;

    def['opal$!'] = function() {
      var self = this;

      return true;
    };

    def['opal$&'] = function(other) {
      var self = this;

      return false;
    };

    def['opal$|'] = function(other) {
      var self = this;

      return other !== false && other !== nil;
    };

    def['opal$^'] = function(other) {
      var self = this;

      return other !== false && other !== nil;
    };

    def['opal$=='] = function(other) {
      var self = this;

      return other === nil;
    };

    def.opal$dup = function() {
      var self = this;

      return self.opal$raise(opal$scope.TypeError);
    };

    def.opal$inspect = function() {
      var self = this;

      return "nil";
    };

    def['opal$nil?'] = function() {
      var self = this;

      return true;
    };

    def.opal$singleton_class = function() {
      var self = this;

      return opal$scope.NilClass;
    };

    def.opal$to_a = function() {
      var self = this;

      return [];
    };

    def.opal$to_h = function() {
      var self = this;

      return opal$opal.hash();
    };

    def.opal$to_i = function() {
      var self = this;

      return 0;
    };

    opal$opal.defn(self, 'opal$to_f', def.opal$to_i);

    def.opal$to_s = function() {
      var self = this;

      return "";
    };

    def.opal$object_id = function() {
      var self = this;

      return opal$scope.NilClass._id || (opal$scope.NilClass._id = opal$opal.uid());
    };

    return opal$opal.defn(self, 'opal$hash', def.opal$object_id);
  })(self, null);
  return opal$opal.cdecl(opal$scope, 'NIL', nil);
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass;

  (function(opal$base, opal$super) {
    function opal$Boolean(){};
    var self = opal$Boolean = opal$klass(opal$base, opal$super, 'Boolean', opal$Boolean);

    var def = self._proto, opal$scope = self._scope;

    def._isBoolean = true;

    (function(self) {
      var opal$scope = self._scope, def = self._proto;

      return self.opal$undef_method("new")
    })(self.opal$singleton_class());

    def['opal$!'] = function() {
      var self = this;

      return self != true;
    };

    def['opal$&'] = function(other) {
      var self = this;

      return (self == true) ? (other !== false && other !== nil) : false;
    };

    def['opal$|'] = function(other) {
      var self = this;

      return (self == true) ? true : (other !== false && other !== nil);
    };

    def['opal$^'] = function(other) {
      var self = this;

      return (self == true) ? (other === false || other === nil) : (other !== false && other !== nil);
    };

    def['opal$=='] = function(other) {
      var self = this;

      return (self == true) === other.valueOf();
    };

    opal$opal.defn(self, 'opal$equal?', def['opal$==']);

    opal$opal.defn(self, 'opal$singleton_class', def.opal$class);

    return (def.opal$to_s = function() {
      var self = this;

      return (self == true) ? 'true' : 'false';
    }, nil) && 'to_s';
  })(self, null);
  opal$opal.cdecl(opal$scope, 'TrueClass', opal$scope.Boolean);
  opal$opal.cdecl(opal$scope, 'FalseClass', opal$scope.Boolean);
  opal$opal.cdecl(opal$scope, 'TRUE', true);
  return opal$opal.cdecl(opal$scope, 'FALSE', false);
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass, opal$module = opal$opal.module;

  (function(opal$base, opal$super) {
    function opal$Exception(){};
    var self = opal$Exception = opal$klass(opal$base, opal$super, 'Exception', opal$Exception);

    var def = self._proto, opal$scope = self._scope;

    def.message = nil;
    self.opal$attr_reader("message");

    opal$opal.defs(self, 'opal$new', function(message) {
      var self = this;

      if (message == null) {
        message = ""
      }
      
      var err = new Error(message);
      err._klass = self;
      err.name = self._name;
      return err;
    
    });

    def.opal$backtrace = function() {
      var self = this;

      
      var backtrace = self.stack;

      if (typeof(backtrace) === 'string') {
        return backtrace.split("\n").slice(0, 15);
      }
      else if (backtrace) {
        return backtrace.slice(0, 15);
      }

      return [];
    
    };

    def.opal$inspect = function() {
      var self = this;

      return "#<" + (self.opal$class().opal$name()) + ": '" + (self.message) + "'>";
    };

    return opal$opal.defn(self, 'opal$to_s', def.opal$message);
  })(self, null);
  (function(opal$base, opal$super) {
    function opal$ScriptError(){};
    var self = opal$ScriptError = opal$klass(opal$base, opal$super, 'ScriptError', opal$ScriptError);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.Exception);
  (function(opal$base, opal$super) {
    function opal$SyntaxError(){};
    var self = opal$SyntaxError = opal$klass(opal$base, opal$super, 'SyntaxError', opal$SyntaxError);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.ScriptError);
  (function(opal$base, opal$super) {
    function opal$LoadError(){};
    var self = opal$LoadError = opal$klass(opal$base, opal$super, 'LoadError', opal$LoadError);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.ScriptError);
  (function(opal$base, opal$super) {
    function opal$NotImplementedError(){};
    var self = opal$NotImplementedError = opal$klass(opal$base, opal$super, 'NotImplementedError', opal$NotImplementedError);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.ScriptError);
  (function(opal$base, opal$super) {
    function opal$SystemExit(){};
    var self = opal$SystemExit = opal$klass(opal$base, opal$super, 'SystemExit', opal$SystemExit);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.Exception);
  (function(opal$base, opal$super) {
    function opal$StandardError(){};
    var self = opal$StandardError = opal$klass(opal$base, opal$super, 'StandardError', opal$StandardError);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.Exception);
  (function(opal$base, opal$super) {
    function opal$NameError(){};
    var self = opal$NameError = opal$klass(opal$base, opal$super, 'NameError', opal$NameError);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.StandardError);
  (function(opal$base, opal$super) {
    function opal$NoMethodError(){};
    var self = opal$NoMethodError = opal$klass(opal$base, opal$super, 'NoMethodError', opal$NoMethodError);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.NameError);
  (function(opal$base, opal$super) {
    function opal$RuntimeError(){};
    var self = opal$RuntimeError = opal$klass(opal$base, opal$super, 'RuntimeError', opal$RuntimeError);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.StandardError);
  (function(opal$base, opal$super) {
    function opal$LocalJumpError(){};
    var self = opal$LocalJumpError = opal$klass(opal$base, opal$super, 'LocalJumpError', opal$LocalJumpError);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.StandardError);
  (function(opal$base, opal$super) {
    function opal$TypeError(){};
    var self = opal$TypeError = opal$klass(opal$base, opal$super, 'TypeError', opal$TypeError);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.StandardError);
  (function(opal$base, opal$super) {
    function opal$ArgumentError(){};
    var self = opal$ArgumentError = opal$klass(opal$base, opal$super, 'ArgumentError', opal$ArgumentError);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.StandardError);
  (function(opal$base, opal$super) {
    function opal$IndexError(){};
    var self = opal$IndexError = opal$klass(opal$base, opal$super, 'IndexError', opal$IndexError);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.StandardError);
  (function(opal$base, opal$super) {
    function opal$StopIteration(){};
    var self = opal$StopIteration = opal$klass(opal$base, opal$super, 'StopIteration', opal$StopIteration);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.IndexError);
  (function(opal$base, opal$super) {
    function opal$KeyError(){};
    var self = opal$KeyError = opal$klass(opal$base, opal$super, 'KeyError', opal$KeyError);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.IndexError);
  (function(opal$base, opal$super) {
    function opal$RangeError(){};
    var self = opal$RangeError = opal$klass(opal$base, opal$super, 'RangeError', opal$RangeError);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.StandardError);
  (function(opal$base, opal$super) {
    function opal$FloatDomainError(){};
    var self = opal$FloatDomainError = opal$klass(opal$base, opal$super, 'FloatDomainError', opal$FloatDomainError);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.RangeError);
  (function(opal$base, opal$super) {
    function opal$IOError(){};
    var self = opal$IOError = opal$klass(opal$base, opal$super, 'IOError', opal$IOError);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.StandardError);
  (function(opal$base, opal$super) {
    function opal$SystemCallError(){};
    var self = opal$SystemCallError = opal$klass(opal$base, opal$super, 'SystemCallError', opal$SystemCallError);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.StandardError);
  return (function(opal$base) {
    var self = opal$module(opal$base, 'Errno');

    var def = self._proto, opal$scope = self._scope;

    (function(opal$base, opal$super) {
      function opal$EINVAL(){};
      var self = opal$EINVAL = opal$klass(opal$base, opal$super, 'EINVAL', opal$EINVAL);

      var def = self._proto, opal$scope = self._scope, TMP_1;

      return (opal$opal.defs(self, 'opal$new', TMP_1 = function() {
        var self = this, opal$iter = TMP_1._p, opal$yield = opal$iter || nil;

        TMP_1._p = null;
        return opal$opal.find_super_dispatcher(self, 'new', TMP_1, null, opal$EINVAL).apply(self, ["Invalid argument"]);
      }), nil) && 'new'
    })(self, opal$scope.SystemCallError)
    
  })(self);
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass, opal$gvars = opal$opal.gvars;

  return (function(opal$base, opal$super) {
    function opal$Regexp(){};
    var self = opal$Regexp = opal$klass(opal$base, opal$super, 'Regexp', opal$Regexp);

    var def = self._proto, opal$scope = self._scope, TMP_1;

    def._isRegexp = true;

    (function(self) {
      var opal$scope = self._scope, def = self._proto;

      self._proto.opal$escape = function(string) {
        var self = this;

        
        return string.replace(/([-[\]/{}()*+?.^$\\| ])/g, '\\$1')
                     .replace(/[\n]/g, '\\n')
                     .replace(/[\r]/g, '\\r')
                     .replace(/[\f]/g, '\\f')
                     .replace(/[\t]/g, '\\t');
      
      };
      self._proto.opal$quote = self._proto.opal$escape;
      self._proto.opal$union = function(parts) {
        var self = this;

        parts = opal$slice.call(arguments, 0);
        return new RegExp(parts.join(''));
      };
      return (self._proto.opal$new = function(regexp, options) {
        var self = this;

        return new RegExp(regexp, options);
      }, nil) && 'new';
    })(self.opal$singleton_class());

    def['opal$=='] = function(other) {
      var self = this;

      return other.constructor == RegExp && self.toString() === other.toString();
    };

    def['opal$==='] = function(str) {
      var self = this;

      
      if (!str._isString && str['opal$respond_to?']("to_str")) {
        str = str.opal$to_str();
      }

      if (!str._isString) {
        return false;
      }

      return self.test(str);
    ;
    };

    def['opal$=~'] = function(string) {
      var opal$a, self = this;

      if (((opal$a = string === nil) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        opal$gvars["~"] = opal$gvars["`"] = opal$gvars["'"] = nil;
        return nil;};
      string = opal$scope.Opal.opal$coerce_to(string, opal$scope.String, "to_str").opal$to_s();
      
      var re = self;

      if (re.global) {
        // should we clear it afterwards too?
        re.lastIndex = 0;
      }
      else {
        // rewrite regular expression to add the global flag to capture pre/post match
        re = new RegExp(re.source, 'g' + (re.multiline ? 'm' : '') + (re.ignoreCase ? 'i' : ''));
      }

      var result = re.exec(string);

      if (result) {
        opal$gvars["~"] = opal$scope.MatchData.opal$new(re, result);
      }
      else {
        opal$gvars["~"] = opal$gvars["`"] = opal$gvars["'"] = nil;
      }

      return result ? result.index : nil;
    
    };

    opal$opal.defn(self, 'opal$eql?', def['opal$==']);

    def.opal$inspect = function() {
      var self = this;

      return self.toString();
    };

    def.opal$match = TMP_1 = function(string, pos) {
      var opal$a, self = this, opal$iter = TMP_1._p, block = opal$iter || nil;

      TMP_1._p = null;
      if (((opal$a = string === nil) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        opal$gvars["~"] = opal$gvars["`"] = opal$gvars["'"] = nil;
        return nil;};
      if (((opal$a = string._isString == null) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        if (((opal$a = string['opal$respond_to?']("to_str")) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          } else {
          self.opal$raise(opal$scope.TypeError, "no implicit conversion of " + (string.opal$class()) + " into String")
        };
        string = string.opal$to_str();};
      
      var re = self;

      if (re.global) {
        // should we clear it afterwards too?
        re.lastIndex = 0;
      }
      else {
        re = new RegExp(re.source, 'g' + (re.multiline ? 'm' : '') + (re.ignoreCase ? 'i' : ''));
      }

      var result = re.exec(string);

      if (result) {
        result = opal$gvars["~"] = opal$scope.MatchData.opal$new(re, result);

        if (block === nil) {
          return result;
        }
        else {
          return block.opal$call(result);
        }
      }
      else {
        return opal$gvars["~"] = opal$gvars["`"] = opal$gvars["'"] = nil;
      }
    
    };

    def.opal$source = function() {
      var self = this;

      return self.source;
    };

    return opal$opal.defn(self, 'opal$to_s', def.opal$source);
  })(self, null)
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$module = opal$opal.module;

  return (function(opal$base) {
    var self = opal$module(opal$base, 'Comparable');

    var def = self._proto, opal$scope = self._scope;

    opal$opal.defs(self, 'opal$normalize', function(what) {
      var opal$a, self = this;

      if (((opal$a = opal$scope.Integer['opal$==='](what)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return what};
      if (what['opal$>'](0)) {
        return 1};
      if (what['opal$<'](0)) {
        return -1};
      return 0;
    });

    def['opal$=='] = function(other) {
      var opal$a, self = this, cmp = nil;

      try {
      if (((opal$a = self['opal$equal?'](other)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          return true};
        if (((opal$a = cmp = (self['opal$<=>'](other))) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          } else {
          return false
        };
        return opal$scope.Comparable.opal$normalize(cmp)['opal$=='](0);
      } catch (opal$err) {if (opal$opal.opal$rescue(opal$err, [opal$scope.StandardError])) {
        return false
        }else { throw opal$err; }
      };
    };

    def['opal$>'] = function(other) {
      var opal$a, self = this, cmp = nil;

      if (((opal$a = cmp = (self['opal$<=>'](other))) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.ArgumentError, "comparison of " + (self.opal$class()) + " with " + (other.opal$class()) + " failed")
      };
      return opal$scope.Comparable.opal$normalize(cmp)['opal$>'](0);
    };

    def['opal$>='] = function(other) {
      var opal$a, self = this, cmp = nil;

      if (((opal$a = cmp = (self['opal$<=>'](other))) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.ArgumentError, "comparison of " + (self.opal$class()) + " with " + (other.opal$class()) + " failed")
      };
      return opal$scope.Comparable.opal$normalize(cmp)['opal$>='](0);
    };

    def['opal$<'] = function(other) {
      var opal$a, self = this, cmp = nil;

      if (((opal$a = cmp = (self['opal$<=>'](other))) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.ArgumentError, "comparison of " + (self.opal$class()) + " with " + (other.opal$class()) + " failed")
      };
      return opal$scope.Comparable.opal$normalize(cmp)['opal$<'](0);
    };

    def['opal$<='] = function(other) {
      var opal$a, self = this, cmp = nil;

      if (((opal$a = cmp = (self['opal$<=>'](other))) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.ArgumentError, "comparison of " + (self.opal$class()) + " with " + (other.opal$class()) + " failed")
      };
      return opal$scope.Comparable.opal$normalize(cmp)['opal$<='](0);
    };

    def['opal$between?'] = function(min, max) {
      var self = this;

      if (self['opal$<'](min)) {
        return false};
      if (self['opal$>'](max)) {
        return false};
      return true;
    };
        ;opal$opal.donate(self, ["opal$==", "opal$>", "opal$>=", "opal$<", "opal$<=", "opal$between?"]);
  })(self)
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$module = opal$opal.module;

  return (function(opal$base) {
    var self = opal$module(opal$base, 'Enumerable');

    var def = self._proto, opal$scope = self._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_7, TMP_8, TMP_9, TMP_10, TMP_11, TMP_12, TMP_13, TMP_14, TMP_15, TMP_16, TMP_17, TMP_18, TMP_19, TMP_20, TMP_22, TMP_23, TMP_24, TMP_25, TMP_26, TMP_27, TMP_28, TMP_29, TMP_30, TMP_31, TMP_32, TMP_33, TMP_35, TMP_36, TMP_40, TMP_41;

    def['opal$all?'] = TMP_1 = function() {
      var opal$a, self = this, opal$iter = TMP_1._p, block = opal$iter || nil;

      TMP_1._p = null;
      
      var result = true;

      if (block !== nil) {
        self.opal$each._p = function() {
          var value = opal$opal.opal$yieldX(block, arguments);

          if (value === opal$breaker) {
            result = opal$breaker.opal$v;
            return opal$breaker;
          }

          if (((opal$a = value) === nil || (opal$a._isBoolean && opal$a == false))) {
            result = false;
            return opal$breaker;
          }
        }
      }
      else {
        self.opal$each._p = function(obj) {
          if (arguments.length == 1 && ((opal$a = obj) === nil || (opal$a._isBoolean && opal$a == false))) {
            result = false;
            return opal$breaker;
          }
        }
      }

      self.opal$each();

      return result;
    
    };

    def['opal$any?'] = TMP_2 = function() {
      var opal$a, self = this, opal$iter = TMP_2._p, block = opal$iter || nil;

      TMP_2._p = null;
      
      var result = false;

      if (block !== nil) {
        self.opal$each._p = function() {
          var value = opal$opal.opal$yieldX(block, arguments);

          if (value === opal$breaker) {
            result = opal$breaker.opal$v;
            return opal$breaker;
          }

          if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true))) {
            result = true;
            return opal$breaker;
          }
        };
      }
      else {
        self.opal$each._p = function(obj) {
          if (arguments.length != 1 || ((opal$a = obj) !== nil && (!opal$a._isBoolean || opal$a == true))) {
            result = true;
            return opal$breaker;
          }
        }
      }

      self.opal$each();

      return result;
    
    };

    def.opal$chunk = TMP_3 = function(state) {
      var self = this, opal$iter = TMP_3._p, block = opal$iter || nil;

      TMP_3._p = null;
      return self.opal$raise(opal$scope.NotImplementedError);
    };

    def.opal$collect = TMP_4 = function() {
      var self = this, opal$iter = TMP_4._p, block = opal$iter || nil;

      TMP_4._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("collect")
      };
      
      var result = [];

      self.opal$each._p = function() {
        var value = opal$opal.opal$yieldX(block, arguments);

        if (value === opal$breaker) {
          result = opal$breaker.opal$v;
          return opal$breaker;
        }

        result.push(value);
      };

      self.opal$each();

      return result;
    
    };

    def.opal$collect_concat = TMP_5 = function() {
      var opal$a, opal$b, TMP_6, self = this, opal$iter = TMP_5._p, block = opal$iter || nil;

      TMP_5._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("collect_concat")
      };
      return (opal$a = (opal$b = self).opal$map, opal$a._p = (TMP_6 = function(item){var self = TMP_6._s || this, opal$a;
if (item == null) item = nil;
      return opal$a = opal$opal.opal$yield1(block, item), opal$a === opal$breaker ? opal$a : opal$a}, TMP_6._s = self, TMP_6), opal$a).call(opal$b).opal$flatten(1);
    };

    def.opal$count = TMP_7 = function(object) {
      var opal$a, self = this, opal$iter = TMP_7._p, block = opal$iter || nil;

      TMP_7._p = null;
      
      var result = 0;

      if (object != null) {
        block = function() {
          return opal$scope.Opal.opal$destructure(arguments)['opal$=='](object);
        };
      }
      else if (block === nil) {
        block = function() { return true; };
      }

      self.opal$each._p = function() {
        var value = opal$opal.opal$yieldX(block, arguments);

        if (value === opal$breaker) {
          result = opal$breaker.opal$v;
          return opal$breaker;
        }

        if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          result++;
        }
      }

      self.opal$each();

      return result;
    
    };

    def.opal$cycle = TMP_8 = function(n) {
      var opal$a, self = this, opal$iter = TMP_8._p, block = opal$iter || nil;

      if (n == null) {
        n = nil
      }
      TMP_8._p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("cycle", n)
      };
      if (((opal$a = n['opal$nil?']()) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        n = opal$scope.Opal['opal$coerce_to!'](n, opal$scope.Integer, "to_int");
        if (((opal$a = n <= 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          return nil};
      };
      
      var result,
          all  = [];

      self.opal$each._p = function() {
        var param = opal$scope.Opal.opal$destructure(arguments),
            value = opal$opal.opal$yield1(block, param);

        if (value === opal$breaker) {
          result = opal$breaker.opal$v;
          return opal$breaker;
        }

        all.push(param);
      }

      self.opal$each();

      if (result !== undefined) {
        return result;
      }

      if (all.length === 0) {
        return nil;
      }
    
      if (((opal$a = n['opal$nil?']()) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        
        while (true) {
          for (var i = 0, length = all.length; i < length; i++) {
            var value = opal$opal.opal$yield1(block, all[i]);

            if (value === opal$breaker) {
              return opal$breaker.opal$v;
            }
          }
        }
      
        } else {
        
        while (n > 1) {
          for (var i = 0, length = all.length; i < length; i++) {
            var value = opal$opal.opal$yield1(block, all[i]);

            if (value === opal$breaker) {
              return opal$breaker.opal$v;
            }
          }

          n--;
        }
      
      };
    };

    def.opal$detect = TMP_9 = function(ifnone) {
      var opal$a, self = this, opal$iter = TMP_9._p, block = opal$iter || nil;

      TMP_9._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("detect", ifnone)
      };
      
      var result = undefined;

      self.opal$each._p = function() {
        var params = opal$scope.Opal.opal$destructure(arguments),
            value  = opal$opal.opal$yield1(block, params);

        if (value === opal$breaker) {
          result = opal$breaker.opal$v;
          return opal$breaker;
        }

        if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          result = params;
          return opal$breaker;
        }
      };

      self.opal$each();

      if (result === undefined && ifnone !== undefined) {
        if (typeof(ifnone) === 'function') {
          result = ifnone();
        }
        else {
          result = ifnone;
        }
      }

      return result === undefined ? nil : result;
    
    };

    def.opal$drop = function(number) {
      var opal$a, self = this;

      number = opal$scope.Opal.opal$coerce_to(number, opal$scope.Integer, "to_int");
      if (((opal$a = number < 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.ArgumentError, "attempt to drop negative size")};
      
      var result  = [],
          current = 0;

      self.opal$each._p = function() {
        if (number <= current) {
          result.push(opal$scope.Opal.opal$destructure(arguments));
        }

        current++;
      };

      self.opal$each()

      return result;
    
    };

    def.opal$drop_while = TMP_10 = function() {
      var opal$a, self = this, opal$iter = TMP_10._p, block = opal$iter || nil;

      TMP_10._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("drop_while")
      };
      
      var result   = [],
          dropping = true;

      self.opal$each._p = function() {
        var param = opal$scope.Opal.opal$destructure(arguments);

        if (dropping) {
          var value = opal$opal.opal$yield1(block, param);

          if (value === opal$breaker) {
            result = opal$breaker.opal$v;
            return opal$breaker;
          }

          if (((opal$a = value) === nil || (opal$a._isBoolean && opal$a == false))) {
            dropping = false;
            result.push(param);
          }
        }
        else {
          result.push(param);
        }
      };

      self.opal$each();

      return result;
    
    };

    def.opal$each_cons = TMP_11 = function(n) {
      var self = this, opal$iter = TMP_11._p, block = opal$iter || nil;

      TMP_11._p = null;
      return self.opal$raise(opal$scope.NotImplementedError);
    };

    def.opal$each_entry = TMP_12 = function() {
      var self = this, opal$iter = TMP_12._p, block = opal$iter || nil;

      TMP_12._p = null;
      return self.opal$raise(opal$scope.NotImplementedError);
    };

    def.opal$each_slice = TMP_13 = function(n) {
      var opal$a, self = this, opal$iter = TMP_13._p, block = opal$iter || nil;

      TMP_13._p = null;
      n = opal$scope.Opal.opal$coerce_to(n, opal$scope.Integer, "to_int");
      if (((opal$a = n <= 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.ArgumentError, "invalid slice size")};
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("each_slice", n)
      };
      
      var result,
          slice = []

      self.opal$each._p = function() {
        var param = opal$scope.Opal.opal$destructure(arguments);

        slice.push(param);

        if (slice.length === n) {
          if (opal$opal.opal$yield1(block, slice) === opal$breaker) {
            result = opal$breaker.opal$v;
            return opal$breaker;
          }

          slice = [];
        }
      };

      self.opal$each();

      if (result !== undefined) {
        return result;
      }

      // our "last" group, if smaller than n then won't have been yielded
      if (slice.length > 0) {
        if (opal$opal.opal$yield1(block, slice) === opal$breaker) {
          return opal$breaker.opal$v;
        }
      }
    ;
      return nil;
    };

    def.opal$each_with_index = TMP_14 = function(args) {
      var opal$a, self = this, opal$iter = TMP_14._p, block = opal$iter || nil;

      args = opal$slice.call(arguments, 0);
      TMP_14._p = null;
      if ((block !== nil)) {
        } else {
        return (opal$a = self).opal$enum_for.apply(opal$a, ["each_with_index"].concat(args))
      };
      
      var result,
          index = 0;

      self.opal$each._p = function() {
        var param = opal$scope.Opal.opal$destructure(arguments),
            value = block(param, index);

        if (value === opal$breaker) {
          result = opal$breaker.opal$v;
          return opal$breaker;
        }

        index++;
      };

      self.opal$each.apply(self, args);

      if (result !== undefined) {
        return result;
      }
    
      return self;
    };

    def.opal$each_with_object = TMP_15 = function(object) {
      var self = this, opal$iter = TMP_15._p, block = opal$iter || nil;

      TMP_15._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("each_with_object", object)
      };
      
      var result;

      self.opal$each._p = function() {
        var param = opal$scope.Opal.opal$destructure(arguments),
            value = block(param, object);

        if (value === opal$breaker) {
          result = opal$breaker.opal$v;
          return opal$breaker;
        }
      };

      self.opal$each();

      if (result !== undefined) {
        return result;
      }
    
      return object;
    };

    def.opal$entries = function(args) {
      var self = this;

      args = opal$slice.call(arguments, 0);
      
      var result = [];

      self.opal$each._p = function() {
        result.push(opal$scope.Opal.opal$destructure(arguments));
      };

      self.opal$each.apply(self, args);

      return result;
    
    };

    opal$opal.defn(self, 'opal$find', def.opal$detect);

    def.opal$find_all = TMP_16 = function() {
      var opal$a, self = this, opal$iter = TMP_16._p, block = opal$iter || nil;

      TMP_16._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("find_all")
      };
      
      var result = [];

      self.opal$each._p = function() {
        var param = opal$scope.Opal.opal$destructure(arguments),
            value = opal$opal.opal$yield1(block, param);

        if (value === opal$breaker) {
          result = opal$breaker.opal$v;
          return opal$breaker;
        }

        if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          result.push(param);
        }
      };

      self.opal$each();

      return result;
    
    };

    def.opal$find_index = TMP_17 = function(object) {
      var opal$a, self = this, opal$iter = TMP_17._p, block = opal$iter || nil;

      TMP_17._p = null;
      if (((opal$a = object === undefined && block === nil) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return self.opal$enum_for("find_index")};
      
      var result = nil,
          index  = 0;

      if (object != null) {
        self.opal$each._p = function() {
          var param = opal$scope.Opal.opal$destructure(arguments);

          if ((param)['opal$=='](object)) {
            result = index;
            return opal$breaker;
          }

          index += 1;
        };
      }
      else if (block !== nil) {
        self.opal$each._p = function() {
          var value = opal$opal.opal$yieldX(block, arguments);

          if (value === opal$breaker) {
            result = opal$breaker.opal$v;
            return opal$breaker;
          }

          if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true))) {
            result = index;
            return opal$breaker;
          }

          index += 1;
        };
      }

      self.opal$each();

      return result;
    
    };

    def.opal$first = function(number) {
      var opal$a, self = this, result = nil;

      if (((opal$a = number === undefined) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        result = nil;
        
        self.opal$each._p = function() {
          result = opal$scope.Opal.opal$destructure(arguments);

          return opal$breaker;
        };

        self.opal$each();
      ;
        } else {
        result = [];
        number = opal$scope.Opal.opal$coerce_to(number, opal$scope.Integer, "to_int");
        if (((opal$a = number < 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          self.opal$raise(opal$scope.ArgumentError, "attempt to take negative size")};
        if (((opal$a = number == 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          return []};
        
        var current = 0,
            number  = opal$scope.Opal.opal$coerce_to(number, opal$scope.Integer, "to_int");

        self.opal$each._p = function() {
          result.push(opal$scope.Opal.opal$destructure(arguments));

          if (number <= ++current) {
            return opal$breaker;
          }
        };

        self.opal$each();
      ;
      };
      return result;
    };

    opal$opal.defn(self, 'opal$flat_map', def.opal$collect_concat);

    def.opal$grep = TMP_18 = function(pattern) {
      var opal$a, self = this, opal$iter = TMP_18._p, block = opal$iter || nil;

      TMP_18._p = null;
      
      var result = [];

      if (block !== nil) {
        self.opal$each._p = function() {
          var param = opal$scope.Opal.opal$destructure(arguments),
              value = pattern['opal$==='](param);

          if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true))) {
            value = opal$opal.opal$yield1(block, param);

            if (value === opal$breaker) {
              result = opal$breaker.opal$v;
              return opal$breaker;
            }

            result.push(value);
          }
        };
      }
      else {
        self.opal$each._p = function() {
          var param = opal$scope.Opal.opal$destructure(arguments),
              value = pattern['opal$==='](param);

          if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true))) {
            result.push(param);
          }
        };
      }

      self.opal$each();

      return result;
    ;
    };

    def.opal$group_by = TMP_19 = function() {
      var opal$a, opal$b, opal$c, self = this, opal$iter = TMP_19._p, block = opal$iter || nil, hash = nil;

      TMP_19._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("group_by")
      };
      hash = opal$scope.Hash.opal$new();
      
      var result;

      self.opal$each._p = function() {
        var param = opal$scope.Opal.opal$destructure(arguments),
            value = opal$opal.opal$yield1(block, param);

        if (value === opal$breaker) {
          result = opal$breaker.opal$v;
          return opal$breaker;
        }

        ((opal$a = value, opal$b = hash, (((opal$c = opal$b['opal$[]'](opal$a)) !== false && opal$c !== nil) ? opal$c : opal$b['opal$[]='](opal$a, []))))['opal$<<'](param);
      }

      self.opal$each();

      if (result !== undefined) {
        return result;
      }
    
      return hash;
    };

    def['opal$include?'] = function(obj) {
      var self = this;

      
      var result = false;

      self.opal$each._p = function() {
        var param = opal$scope.Opal.opal$destructure(arguments);

        if ((param)['opal$=='](obj)) {
          result = true;
          return opal$breaker;
        }
      }

      self.opal$each();

      return result;
    
    };

    def.opal$inject = TMP_20 = function(object, sym) {
      var self = this, opal$iter = TMP_20._p, block = opal$iter || nil;

      TMP_20._p = null;
      
      var result = object;

      if (block !== nil && sym === undefined) {
        self.opal$each._p = function() {
          var value = opal$scope.Opal.opal$destructure(arguments);

          if (result === undefined) {
            result = value;
            return;
          }

          value = opal$opal.opal$yieldX(block, [result, value]);

          if (value === opal$breaker) {
            result = opal$breaker.opal$v;
            return opal$breaker;
          }

          result = value;
        };
      }
      else {
        if (sym === undefined) {
          if (!opal$scope.Symbol['opal$==='](object)) {
            self.opal$raise(opal$scope.TypeError, "" + (object.opal$inspect()) + " is not a Symbol");
          }

          sym    = object;
          result = undefined;
        }

        self.opal$each._p = function() {
          var value = opal$scope.Opal.opal$destructure(arguments);

          if (result === undefined) {
            result = value;
            return;
          }

          result = (result).opal$__send__(sym, value);
        };
      }

      self.opal$each();

      return result == undefined ? nil : result;
    ;
    };

    def.opal$lazy = function() {
      var opal$a, opal$b, TMP_21, self = this;

      return (opal$a = (opal$b = (opal$scope.Enumerator)._scope.Lazy).opal$new, opal$a._p = (TMP_21 = function(enumopal$, args){var self = TMP_21._s || this, opal$a;
if (enumopal$ == null) enumopal$ = nil;args = opal$slice.call(arguments, 1);
      return (opal$a = enumopal$).opal$yield.apply(opal$a, [].concat(args))}, TMP_21._s = self, TMP_21), opal$a).call(opal$b, self, self.opal$enumerator_size());
    };

    def.opal$enumerator_size = function() {
      var opal$a, self = this;

      if (((opal$a = self['opal$respond_to?']("size")) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return self.opal$size()
        } else {
        return nil
      };
    };

    self.opal$private("enumerator_size");

    opal$opal.defn(self, 'opal$map', def.opal$collect);

    def.opal$max = TMP_22 = function() {
      var self = this, opal$iter = TMP_22._p, block = opal$iter || nil;

      TMP_22._p = null;
      
      var result;

      if (block !== nil) {
        self.opal$each._p = function() {
          var param = opal$scope.Opal.opal$destructure(arguments);

          if (result === undefined) {
            result = param;
            return;
          }

          var value = block(param, result);

          if (value === opal$breaker) {
            result = opal$breaker.opal$v;
            return opal$breaker;
          }

          if (value === nil) {
            self.opal$raise(opal$scope.ArgumentError, "comparison failed");
          }

          if (value > 0) {
            result = param;
          }
        };
      }
      else {
        self.opal$each._p = function() {
          var param = opal$scope.Opal.opal$destructure(arguments);

          if (result === undefined) {
            result = param;
            return;
          }

          if (opal$scope.Opal.opal$compare(param, result) > 0) {
            result = param;
          }
        };
      }

      self.opal$each();

      return result === undefined ? nil : result;
    
    };

    def.opal$max_by = TMP_23 = function() {
      var self = this, opal$iter = TMP_23._p, block = opal$iter || nil;

      TMP_23._p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("max_by")
      };
      
      var result,
          by;

      self.opal$each._p = function() {
        var param = opal$scope.Opal.opal$destructure(arguments),
            value = opal$opal.opal$yield1(block, param);

        if (result === undefined) {
          result = param;
          by     = value;
          return;
        }

        if (value === opal$breaker) {
          result = opal$breaker.opal$v;
          return opal$breaker;
        }

        if ((value)['opal$<=>'](by) > 0) {
          result = param
          by     = value;
        }
      };

      self.opal$each();

      return result === undefined ? nil : result;
    
    };

    opal$opal.defn(self, 'opal$member?', def['opal$include?']);

    def.opal$min = TMP_24 = function() {
      var self = this, opal$iter = TMP_24._p, block = opal$iter || nil;

      TMP_24._p = null;
      
      var result;

      if (block !== nil) {
        self.opal$each._p = function() {
          var param = opal$scope.Opal.opal$destructure(arguments);

          if (result === undefined) {
            result = param;
            return;
          }

          var value = block(param, result);

          if (value === opal$breaker) {
            result = opal$breaker.opal$v;
            return opal$breaker;
          }

          if (value === nil) {
            self.opal$raise(opal$scope.ArgumentError, "comparison failed");
          }

          if (value < 0) {
            result = param;
          }
        };
      }
      else {
        self.opal$each._p = function() {
          var param = opal$scope.Opal.opal$destructure(arguments);

          if (result === undefined) {
            result = param;
            return;
          }

          if (opal$scope.Opal.opal$compare(param, result) < 0) {
            result = param;
          }
        };
      }

      self.opal$each();

      return result === undefined ? nil : result;
    
    };

    def.opal$min_by = TMP_25 = function() {
      var self = this, opal$iter = TMP_25._p, block = opal$iter || nil;

      TMP_25._p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("min_by")
      };
      
      var result,
          by;

      self.opal$each._p = function() {
        var param = opal$scope.Opal.opal$destructure(arguments),
            value = opal$opal.opal$yield1(block, param);

        if (result === undefined) {
          result = param;
          by     = value;
          return;
        }

        if (value === opal$breaker) {
          result = opal$breaker.opal$v;
          return opal$breaker;
        }

        if ((value)['opal$<=>'](by) < 0) {
          result = param
          by     = value;
        }
      };

      self.opal$each();

      return result === undefined ? nil : result;
    
    };

    def.opal$minmax = TMP_26 = function() {
      var self = this, opal$iter = TMP_26._p, block = opal$iter || nil;

      TMP_26._p = null;
      return self.opal$raise(opal$scope.NotImplementedError);
    };

    def.opal$minmax_by = TMP_27 = function() {
      var self = this, opal$iter = TMP_27._p, block = opal$iter || nil;

      TMP_27._p = null;
      return self.opal$raise(opal$scope.NotImplementedError);
    };

    def['opal$none?'] = TMP_28 = function() {
      var opal$a, self = this, opal$iter = TMP_28._p, block = opal$iter || nil;

      TMP_28._p = null;
      
      var result = true;

      if (block !== nil) {
        self.opal$each._p = function() {
          var value = opal$opal.opal$yieldX(block, arguments);

          if (value === opal$breaker) {
            result = opal$breaker.opal$v;
            return opal$breaker;
          }

          if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true))) {
            result = false;
            return opal$breaker;
          }
        }
      }
      else {
        self.opal$each._p = function() {
          var value = opal$scope.Opal.opal$destructure(arguments);

          if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true))) {
            result = false;
            return opal$breaker;
          }
        };
      }

      self.opal$each();

      return result;
    
    };

    def['opal$one?'] = TMP_29 = function() {
      var opal$a, self = this, opal$iter = TMP_29._p, block = opal$iter || nil;

      TMP_29._p = null;
      
      var result = false;

      if (block !== nil) {
        self.opal$each._p = function() {
          var value = opal$opal.opal$yieldX(block, arguments);

          if (value === opal$breaker) {
            result = opal$breaker.opal$v;
            return opal$breaker;
          }

          if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true))) {
            if (result === true) {
              result = false;
              return opal$breaker;
            }

            result = true;
          }
        }
      }
      else {
        self.opal$each._p = function() {
          var value = opal$scope.Opal.opal$destructure(arguments);

          if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true))) {
            if (result === true) {
              result = false;
              return opal$breaker;
            }

            result = true;
          }
        }
      }

      self.opal$each();

      return result;
    
    };

    def.opal$partition = TMP_30 = function() {
      var opal$a, self = this, opal$iter = TMP_30._p, block = opal$iter || nil;

      TMP_30._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("partition")
      };
      
      var truthy = [], falsy = [];

      self.opal$each._p = function() {
        var param = opal$scope.Opal.opal$destructure(arguments),
            value = opal$opal.opal$yield1(block, param);

        if (value === opal$breaker) {
          result = opal$breaker.opal$v;
          return opal$breaker;
        }

        if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          truthy.push(param);
        }
        else {
          falsy.push(param);
        }
      };

      self.opal$each();

      return [truthy, falsy];
    
    };

    opal$opal.defn(self, 'opal$reduce', def.opal$inject);

    def.opal$reject = TMP_31 = function() {
      var opal$a, self = this, opal$iter = TMP_31._p, block = opal$iter || nil;

      TMP_31._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("reject")
      };
      
      var result = [];

      self.opal$each._p = function() {
        var param = opal$scope.Opal.opal$destructure(arguments),
            value = opal$opal.opal$yield1(block, param);

        if (value === opal$breaker) {
          result = opal$breaker.opal$v;
          return opal$breaker;
        }

        if (((opal$a = value) === nil || (opal$a._isBoolean && opal$a == false))) {
          result.push(param);
        }
      };

      self.opal$each();

      return result;
    
    };

    def.opal$reverse_each = TMP_32 = function() {
      var self = this, opal$iter = TMP_32._p, block = opal$iter || nil;

      TMP_32._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("reverse_each")
      };
      
      var result = [];

      self.opal$each._p = function() {
        result.push(arguments);
      };

      self.opal$each();

      for (var i = result.length - 1; i >= 0; i--) {
        opal$opal.opal$yieldX(block, result[i]);
      }

      return result;
    
    };

    opal$opal.defn(self, 'opal$select', def.opal$find_all);

    def.opal$slice_before = TMP_33 = function(pattern) {
      var opal$a, opal$b, TMP_34, self = this, opal$iter = TMP_33._p, block = opal$iter || nil;

      TMP_33._p = null;
      if (((opal$a = pattern === undefined && block === nil || arguments.length > 1) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.ArgumentError, "wrong number of arguments (" + (arguments.length) + " for 1)")};
      return (opal$a = (opal$b = opal$scope.Enumerator).opal$new, opal$a._p = (TMP_34 = function(e){var self = TMP_34._s || this, opal$a;
if (e == null) e = nil;
      
        var slice = [];

        if (block !== nil) {
          if (pattern === undefined) {
            self.opal$each._p = function() {
              var param = opal$scope.Opal.opal$destructure(arguments),
                  value = opal$opal.opal$yield1(block, param);

              if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true)) && slice.length > 0) {
                e['opal$<<'](slice);
                slice = [];
              }

              slice.push(param);
            };
          }
          else {
            self.opal$each._p = function() {
              var param = opal$scope.Opal.opal$destructure(arguments),
                  value = block(param, pattern.opal$dup());

              if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true)) && slice.length > 0) {
                e['opal$<<'](slice);
                slice = [];
              }

              slice.push(param);
            };
          }
        }
        else {
          self.opal$each._p = function() {
            var param = opal$scope.Opal.opal$destructure(arguments),
                value = pattern['opal$==='](param);

            if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true)) && slice.length > 0) {
              e['opal$<<'](slice);
              slice = [];
            }

            slice.push(param);
          };
        }

        self.opal$each();

        if (slice.length > 0) {
          e['opal$<<'](slice);
        }
      ;}, TMP_34._s = self, TMP_34), opal$a).call(opal$b);
    };

    def.opal$sort = TMP_35 = function() {
      var self = this, opal$iter = TMP_35._p, block = opal$iter || nil;

      TMP_35._p = null;
      return self.opal$raise(opal$scope.NotImplementedError);
    };

    def.opal$sort_by = TMP_36 = function() {
      var opal$a, opal$b, TMP_37, opal$c, opal$d, TMP_38, opal$e, opal$f, TMP_39, self = this, opal$iter = TMP_36._p, block = opal$iter || nil;

      TMP_36._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("sort_by")
      };
      return (opal$a = (opal$b = (opal$c = (opal$d = (opal$e = (opal$f = self).opal$map, opal$e._p = (TMP_39 = function(){var self = TMP_39._s || this;

      arg = opal$scope.Opal.opal$destructure(arguments);
        return [block.opal$call(arg), arg];}, TMP_39._s = self, TMP_39), opal$e).call(opal$f)).opal$sort, opal$c._p = (TMP_38 = function(a, b){var self = TMP_38._s || this;
if (a == null) a = nil;if (b == null) b = nil;
      return a['opal$[]'](0)['opal$<=>'](b['opal$[]'](0))}, TMP_38._s = self, TMP_38), opal$c).call(opal$d)).opal$map, opal$a._p = (TMP_37 = function(arg){var self = TMP_37._s || this;
if (arg == null) arg = nil;
      return arg[1];}, TMP_37._s = self, TMP_37), opal$a).call(opal$b);
    };

    def.opal$take = function(num) {
      var self = this;

      return self.opal$first(num);
    };

    def.opal$take_while = TMP_40 = function() {
      var opal$a, self = this, opal$iter = TMP_40._p, block = opal$iter || nil;

      TMP_40._p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("take_while")
      };
      
      var result = [];

      self.opal$each._p = function() {
        var param = opal$scope.Opal.opal$destructure(arguments),
            value = opal$opal.opal$yield1(block, param);

        if (value === opal$breaker) {
          result = opal$breaker.opal$v;
          return opal$breaker;
        }

        if (((opal$a = value) === nil || (opal$a._isBoolean && opal$a == false))) {
          return opal$breaker;
        }

        result.push(param);
      };

      self.opal$each();

      return result;
    
    };

    opal$opal.defn(self, 'opal$to_a', def.opal$entries);

    def.opal$zip = TMP_41 = function(others) {
      var opal$a, self = this, opal$iter = TMP_41._p, block = opal$iter || nil;

      others = opal$slice.call(arguments, 0);
      TMP_41._p = null;
      return (opal$a = self.opal$to_a()).opal$zip.apply(opal$a, [].concat(others));
    };
        ;opal$opal.donate(self, ["opal$all?", "opal$any?", "opal$chunk", "opal$collect", "opal$collect_concat", "opal$count", "opal$cycle", "opal$detect", "opal$drop", "opal$drop_while", "opal$each_cons", "opal$each_entry", "opal$each_slice", "opal$each_with_index", "opal$each_with_object", "opal$entries", "opal$find", "opal$find_all", "opal$find_index", "opal$first", "opal$flat_map", "opal$grep", "opal$group_by", "opal$include?", "opal$inject", "opal$lazy", "opal$enumerator_size", "opal$map", "opal$max", "opal$max_by", "opal$member?", "opal$min", "opal$min_by", "opal$minmax", "opal$minmax_by", "opal$none?", "opal$one?", "opal$partition", "opal$reduce", "opal$reject", "opal$reverse_each", "opal$select", "opal$slice_before", "opal$sort", "opal$sort_by", "opal$take", "opal$take_while", "opal$to_a", "opal$zip"]);
  })(self)
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass;

  ;
  return (function(opal$base, opal$super) {
    function opal$Enumerator(){};
    var self = opal$Enumerator = opal$klass(opal$base, opal$super, 'Enumerator', opal$Enumerator);

    var def = self._proto, opal$scope = self._scope, TMP_1, TMP_2, TMP_3, TMP_4;

    def.size = def.args = def.object = def.method = nil;
    self.opal$include(opal$scope.Enumerable);

    opal$opal.defs(self, 'opal$for', TMP_1 = function(object, method, args) {
      var self = this, opal$iter = TMP_1._p, block = opal$iter || nil;

      args = opal$slice.call(arguments, 2);
      if (method == null) {
        method = "each"
      }
      TMP_1._p = null;
      
      var obj = self.opal$allocate();

      obj.object = object;
      obj.size   = block;
      obj.method = method;
      obj.args   = args;

      return obj;
    ;
    });

    def.opal$initialize = TMP_2 = function() {
      var opal$a, opal$b, self = this, opal$iter = TMP_2._p, block = opal$iter || nil;

      TMP_2._p = null;
      if (block !== false && block !== nil) {
        self.object = (opal$a = (opal$b = opal$scope.Generator).opal$new, opal$a._p = block.opal$to_proc(), opal$a).call(opal$b);
        self.method = "each";
        self.args = [];
        self.size = arguments[0] || nil;
        if (((opal$a = self.size) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          return self.size = opal$scope.Opal.opal$coerce_to(self.size, opal$scope.Integer, "to_int")
          } else {
          return nil
        };
        } else {
        self.object = arguments[0];
        self.method = arguments[1] || "each";
        self.args = opal$slice.call(arguments, 2);
        return self.size = nil;
      };
    };

    def.opal$each = TMP_3 = function(args) {
      var opal$a, opal$b, opal$c, self = this, opal$iter = TMP_3._p, block = opal$iter || nil;

      args = opal$slice.call(arguments, 0);
      TMP_3._p = null;
      if (((opal$a = (opal$b = block['opal$nil?'](), opal$b !== false && opal$b !== nil ?args['opal$empty?']() : opal$b)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return self};
      args = self.args['opal$+'](args);
      if (((opal$a = block['opal$nil?']()) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return (opal$a = self.opal$class()).opal$new.apply(opal$a, [self.object, self.method].concat(args))};
      return (opal$b = (opal$c = self.object).opal$__send__, opal$b._p = block.opal$to_proc(), opal$b).apply(opal$c, [self.method].concat(args));
    };

    def.opal$size = function() {
      var opal$a, self = this;

      if (((opal$a = opal$scope.Proc['opal$==='](self.size)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return (opal$a = self.size).opal$call.apply(opal$a, [].concat(self.args))
        } else {
        return self.size
      };
    };

    def.opal$with_index = TMP_4 = function(offset) {
      var self = this, opal$iter = TMP_4._p, block = opal$iter || nil;

      if (offset == null) {
        offset = 0
      }
      TMP_4._p = null;
      if (offset !== false && offset !== nil) {
        offset = opal$scope.Opal.opal$coerce_to(offset, opal$scope.Integer, "to_int")
        } else {
        offset = 0
      };
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("with_index", offset)
      };
      
      var result

      self.opal$each._p = function() {
        var param = opal$scope.Opal.opal$destructure(arguments),
            value = block(param, index);

        if (value === opal$breaker) {
          result = opal$breaker.opal$v;
          return opal$breaker;
        }

        index++;
      }

      self.opal$each();

      if (result !== undefined) {
        return result;
      }
    ;
    };

    opal$opal.defn(self, 'opal$with_object', def.opal$each_with_object);

    def.opal$inspect = function() {
      var opal$a, self = this, result = nil;

      result = "#<" + (self.opal$class().opal$name()) + ": " + (self.object.opal$inspect()) + ":" + (self.method);
      if (((opal$a = self.args['opal$empty?']()) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        result = result['opal$+']("(" + (self.args.opal$inspect()['opal$[]'](opal$scope.Range.opal$new(1, -2))) + ")")
      };
      return result['opal$+'](">");
    };

    (function(opal$base, opal$super) {
      function opal$Generator(){};
      var self = opal$Generator = opal$klass(opal$base, opal$super, 'Generator', opal$Generator);

      var def = self._proto, opal$scope = self._scope, TMP_5, TMP_6;

      def.block = nil;
      self.opal$include(opal$scope.Enumerable);

      def.opal$initialize = TMP_5 = function() {
        var self = this, opal$iter = TMP_5._p, block = opal$iter || nil;

        TMP_5._p = null;
        if (block !== false && block !== nil) {
          } else {
          self.opal$raise(opal$scope.LocalJumpError, "no block given")
        };
        return self.block = block;
      };

      return (def.opal$each = TMP_6 = function(args) {
        var opal$a, opal$b, self = this, opal$iter = TMP_6._p, block = opal$iter || nil, yielder = nil;

        args = opal$slice.call(arguments, 0);
        TMP_6._p = null;
        yielder = (opal$a = (opal$b = opal$scope.Yielder).opal$new, opal$a._p = block.opal$to_proc(), opal$a).call(opal$b);
        
        try {
          args.unshift(yielder);

          if (opal$opal.opal$yieldX(self.block, args) === opal$breaker) {
            return opal$breaker.opal$v;
          }
        }
        catch (e) {
          if (e === opal$breaker) {
            return opal$breaker.opal$v;
          }
          else {
            throw e;
          }
        }
      ;
        return self;
      }, nil) && 'each';
    })(self, null);

    (function(opal$base, opal$super) {
      function opal$Yielder(){};
      var self = opal$Yielder = opal$klass(opal$base, opal$super, 'Yielder', opal$Yielder);

      var def = self._proto, opal$scope = self._scope, TMP_7;

      def.block = nil;
      def.opal$initialize = TMP_7 = function() {
        var self = this, opal$iter = TMP_7._p, block = opal$iter || nil;

        TMP_7._p = null;
        return self.block = block;
      };

      def.opal$yield = function(values) {
        var self = this;

        values = opal$slice.call(arguments, 0);
        
        var value = opal$opal.opal$yieldX(self.block, values);

        if (value === opal$breaker) {
          throw opal$breaker;
        }

        return value;
      ;
      };

      return (def['opal$<<'] = function(values) {
        var opal$a, self = this;

        values = opal$slice.call(arguments, 0);
        (opal$a = self).opal$yield.apply(opal$a, [].concat(values));
        return self;
      }, nil) && '<<';
    })(self, null);

    return (function(opal$base, opal$super) {
      function opal$Lazy(){};
      var self = opal$Lazy = opal$klass(opal$base, opal$super, 'Lazy', opal$Lazy);

      var def = self._proto, opal$scope = self._scope, TMP_8, TMP_11, TMP_13, TMP_18, TMP_20, TMP_21, TMP_23, TMP_26, TMP_29;

      def.enumerator = nil;
      (function(opal$base, opal$super) {
        function opal$StopLazyError(){};
        var self = opal$StopLazyError = opal$klass(opal$base, opal$super, 'StopLazyError', opal$StopLazyError);

        var def = self._proto, opal$scope = self._scope;

        return nil;
      })(self, opal$scope.Exception);

      def.opal$initialize = TMP_8 = function(object, size) {
        var TMP_9, self = this, opal$iter = TMP_8._p, block = opal$iter || nil;

        if (size == null) {
          size = nil
        }
        TMP_8._p = null;
        if ((block !== nil)) {
          } else {
          self.opal$raise(opal$scope.ArgumentError, "tried to call lazy new without a block")
        };
        self.enumerator = object;
        return opal$opal.find_super_dispatcher(self, 'initialize', TMP_8, (TMP_9 = function(yielder, each_args){var self = TMP_9._s || this, opal$a, opal$b, TMP_10;
if (yielder == null) yielder = nil;each_args = opal$slice.call(arguments, 1);
        try {
          return (opal$a = (opal$b = object).opal$each, opal$a._p = (TMP_10 = function(args){var self = TMP_10._s || this;
args = opal$slice.call(arguments, 0);
            
              args.unshift(yielder);

              if (opal$opal.opal$yieldX(block, args) === opal$breaker) {
                return opal$breaker;
              }
            ;}, TMP_10._s = self, TMP_10), opal$a).apply(opal$b, [].concat(each_args))
          } catch (opal$err) {if (opal$opal.opal$rescue(opal$err, [opal$scope.Exception])) {
            return nil
            }else { throw opal$err; }
          }}, TMP_9._s = self, TMP_9)).apply(self, [size]);
      };

      opal$opal.defn(self, 'opal$force', def.opal$to_a);

      def.opal$lazy = function() {
        var self = this;

        return self;
      };

      def.opal$collect = TMP_11 = function() {
        var opal$a, opal$b, TMP_12, self = this, opal$iter = TMP_11._p, block = opal$iter || nil;

        TMP_11._p = null;
        if (block !== false && block !== nil) {
          } else {
          self.opal$raise(opal$scope.ArgumentError, "tried to call lazy map without a block")
        };
        return (opal$a = (opal$b = opal$scope.Lazy).opal$new, opal$a._p = (TMP_12 = function(enumopal$, args){var self = TMP_12._s || this;
if (enumopal$ == null) enumopal$ = nil;args = opal$slice.call(arguments, 1);
        
          var value = opal$opal.opal$yieldX(block, args);

          if (value === opal$breaker) {
            return opal$breaker;
          }

          enumopal$.opal$yield(value);
        }, TMP_12._s = self, TMP_12), opal$a).call(opal$b, self, self.opal$enumerator_size());
      };

      def.opal$collect_concat = TMP_13 = function() {
        var opal$a, opal$b, TMP_14, self = this, opal$iter = TMP_13._p, block = opal$iter || nil;

        TMP_13._p = null;
        if (block !== false && block !== nil) {
          } else {
          self.opal$raise(opal$scope.ArgumentError, "tried to call lazy map without a block")
        };
        return (opal$a = (opal$b = opal$scope.Lazy).opal$new, opal$a._p = (TMP_14 = function(enumopal$, args){var self = TMP_14._s || this, opal$a, opal$b, TMP_15, opal$c, TMP_16;
if (enumopal$ == null) enumopal$ = nil;args = opal$slice.call(arguments, 1);
        
          var value = opal$opal.opal$yieldX(block, args);

          if (value === opal$breaker) {
            return opal$breaker;
          }

          if ((value)['opal$respond_to?']("force") && (value)['opal$respond_to?']("each")) {
            (opal$a = (opal$b = (value)).opal$each, opal$a._p = (TMP_15 = function(v){var self = TMP_15._s || this;
if (v == null) v = nil;
          return enumopal$.opal$yield(v)}, TMP_15._s = self, TMP_15), opal$a).call(opal$b)
          }
          else {
            var array = opal$scope.Opal.opal$try_convert(value, opal$scope.Array, "to_ary");

            if (array === nil) {
              enumopal$.opal$yield(value);
            }
            else {
              (opal$a = (opal$c = (value)).opal$each, opal$a._p = (TMP_16 = function(v){var self = TMP_16._s || this;
if (v == null) v = nil;
          return enumopal$.opal$yield(v)}, TMP_16._s = self, TMP_16), opal$a).call(opal$c);
            }
          }
        ;}, TMP_14._s = self, TMP_14), opal$a).call(opal$b, self, nil);
      };

      def.opal$drop = function(n) {
        var opal$a, opal$b, TMP_17, self = this, current_size = nil, set_size = nil, dropped = nil;

        n = opal$scope.Opal.opal$coerce_to(n, opal$scope.Integer, "to_int");
        if (n['opal$<'](0)) {
          self.opal$raise(opal$scope.ArgumentError, "attempt to drop negative size")};
        current_size = self.opal$enumerator_size();
        set_size = (function() {if (((opal$a = opal$scope.Integer['opal$==='](current_size)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          if (n['opal$<'](current_size)) {
            return n
            } else {
            return current_size
          }
          } else {
          return current_size
        }; return nil; })();
        dropped = 0;
        return (opal$a = (opal$b = opal$scope.Lazy).opal$new, opal$a._p = (TMP_17 = function(enumopal$, args){var self = TMP_17._s || this, opal$a;
if (enumopal$ == null) enumopal$ = nil;args = opal$slice.call(arguments, 1);
        if (dropped['opal$<'](n)) {
            return dropped = dropped['opal$+'](1)
            } else {
            return (opal$a = enumopal$).opal$yield.apply(opal$a, [].concat(args))
          }}, TMP_17._s = self, TMP_17), opal$a).call(opal$b, self, set_size);
      };

      def.opal$drop_while = TMP_18 = function() {
        var opal$a, opal$b, TMP_19, self = this, opal$iter = TMP_18._p, block = opal$iter || nil, succeeding = nil;

        TMP_18._p = null;
        if (block !== false && block !== nil) {
          } else {
          self.opal$raise(opal$scope.ArgumentError, "tried to call lazy drop_while without a block")
        };
        succeeding = true;
        return (opal$a = (opal$b = opal$scope.Lazy).opal$new, opal$a._p = (TMP_19 = function(enumopal$, args){var self = TMP_19._s || this, opal$a, opal$b;
if (enumopal$ == null) enumopal$ = nil;args = opal$slice.call(arguments, 1);
        if (succeeding !== false && succeeding !== nil) {
            
            var value = opal$opal.opal$yieldX(block, args);

            if (value === opal$breaker) {
              return opal$breaker;
            }

            if (((opal$a = value) === nil || (opal$a._isBoolean && opal$a == false))) {
              succeeding = false;

              (opal$a = enumopal$).opal$yield.apply(opal$a, [].concat(args));
            }
          
            } else {
            return (opal$b = enumopal$).opal$yield.apply(opal$b, [].concat(args))
          }}, TMP_19._s = self, TMP_19), opal$a).call(opal$b, self, nil);
      };

      def.opal$enum_for = TMP_20 = function(method, args) {
        var opal$a, opal$b, self = this, opal$iter = TMP_20._p, block = opal$iter || nil;

        args = opal$slice.call(arguments, 1);
        if (method == null) {
          method = "each"
        }
        TMP_20._p = null;
        return (opal$a = (opal$b = self.opal$class()).opal$for, opal$a._p = block.opal$to_proc(), opal$a).apply(opal$b, [self, method].concat(args));
      };

      def.opal$find_all = TMP_21 = function() {
        var opal$a, opal$b, TMP_22, self = this, opal$iter = TMP_21._p, block = opal$iter || nil;

        TMP_21._p = null;
        if (block !== false && block !== nil) {
          } else {
          self.opal$raise(opal$scope.ArgumentError, "tried to call lazy select without a block")
        };
        return (opal$a = (opal$b = opal$scope.Lazy).opal$new, opal$a._p = (TMP_22 = function(enumopal$, args){var self = TMP_22._s || this, opal$a;
if (enumopal$ == null) enumopal$ = nil;args = opal$slice.call(arguments, 1);
        
          var value = opal$opal.opal$yieldX(block, args);

          if (value === opal$breaker) {
            return opal$breaker;
          }

          if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true))) {
            (opal$a = enumopal$).opal$yield.apply(opal$a, [].concat(args));
          }
        ;}, TMP_22._s = self, TMP_22), opal$a).call(opal$b, self, nil);
      };

      opal$opal.defn(self, 'opal$flat_map', def.opal$collect_concat);

      def.opal$grep = TMP_23 = function(pattern) {
        var opal$a, opal$b, TMP_24, opal$c, TMP_25, self = this, opal$iter = TMP_23._p, block = opal$iter || nil;

        TMP_23._p = null;
        if (block !== false && block !== nil) {
          return (opal$a = (opal$b = opal$scope.Lazy).opal$new, opal$a._p = (TMP_24 = function(enumopal$, args){var self = TMP_24._s || this, opal$a;
if (enumopal$ == null) enumopal$ = nil;args = opal$slice.call(arguments, 1);
          
            var param = opal$scope.Opal.opal$destructure(args),
                value = pattern['opal$==='](param);

            if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true))) {
              value = opal$opal.opal$yield1(block, param);

              if (value === opal$breaker) {
                return opal$breaker;
              }

              enumopal$.opal$yield(opal$opal.opal$yield1(block, param));
            }
          ;}, TMP_24._s = self, TMP_24), opal$a).call(opal$b, self, nil)
          } else {
          return (opal$a = (opal$c = opal$scope.Lazy).opal$new, opal$a._p = (TMP_25 = function(enumopal$, args){var self = TMP_25._s || this, opal$a;
if (enumopal$ == null) enumopal$ = nil;args = opal$slice.call(arguments, 1);
          
            var param = opal$scope.Opal.opal$destructure(args),
                value = pattern['opal$==='](param);

            if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true))) {
              enumopal$.opal$yield(param);
            }
          ;}, TMP_25._s = self, TMP_25), opal$a).call(opal$c, self, nil)
        };
      };

      opal$opal.defn(self, 'opal$map', def.opal$collect);

      opal$opal.defn(self, 'opal$select', def.opal$find_all);

      def.opal$reject = TMP_26 = function() {
        var opal$a, opal$b, TMP_27, self = this, opal$iter = TMP_26._p, block = opal$iter || nil;

        TMP_26._p = null;
        if (block !== false && block !== nil) {
          } else {
          self.opal$raise(opal$scope.ArgumentError, "tried to call lazy reject without a block")
        };
        return (opal$a = (opal$b = opal$scope.Lazy).opal$new, opal$a._p = (TMP_27 = function(enumopal$, args){var self = TMP_27._s || this, opal$a;
if (enumopal$ == null) enumopal$ = nil;args = opal$slice.call(arguments, 1);
        
          var value = opal$opal.opal$yieldX(block, args);

          if (value === opal$breaker) {
            return opal$breaker;
          }

          if (((opal$a = value) === nil || (opal$a._isBoolean && opal$a == false))) {
            (opal$a = enumopal$).opal$yield.apply(opal$a, [].concat(args));
          }
        ;}, TMP_27._s = self, TMP_27), opal$a).call(opal$b, self, nil);
      };

      def.opal$take = function(n) {
        var opal$a, opal$b, TMP_28, self = this, current_size = nil, set_size = nil, taken = nil;

        n = opal$scope.Opal.opal$coerce_to(n, opal$scope.Integer, "to_int");
        if (n['opal$<'](0)) {
          self.opal$raise(opal$scope.ArgumentError, "attempt to take negative size")};
        current_size = self.opal$enumerator_size();
        set_size = (function() {if (((opal$a = opal$scope.Integer['opal$==='](current_size)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          if (n['opal$<'](current_size)) {
            return n
            } else {
            return current_size
          }
          } else {
          return current_size
        }; return nil; })();
        taken = 0;
        return (opal$a = (opal$b = opal$scope.Lazy).opal$new, opal$a._p = (TMP_28 = function(enumopal$, args){var self = TMP_28._s || this, opal$a;
if (enumopal$ == null) enumopal$ = nil;args = opal$slice.call(arguments, 1);
        if (taken['opal$<'](n)) {
            (opal$a = enumopal$).opal$yield.apply(opal$a, [].concat(args));
            return taken = taken['opal$+'](1);
            } else {
            return self.opal$raise(opal$scope.StopLazyError)
          }}, TMP_28._s = self, TMP_28), opal$a).call(opal$b, self, set_size);
      };

      def.opal$take_while = TMP_29 = function() {
        var opal$a, opal$b, TMP_30, self = this, opal$iter = TMP_29._p, block = opal$iter || nil;

        TMP_29._p = null;
        if (block !== false && block !== nil) {
          } else {
          self.opal$raise(opal$scope.ArgumentError, "tried to call lazy take_while without a block")
        };
        return (opal$a = (opal$b = opal$scope.Lazy).opal$new, opal$a._p = (TMP_30 = function(enumopal$, args){var self = TMP_30._s || this, opal$a;
if (enumopal$ == null) enumopal$ = nil;args = opal$slice.call(arguments, 1);
        
          var value = opal$opal.opal$yieldX(block, args);

          if (value === opal$breaker) {
            return opal$breaker;
          }

          if (((opal$a = value) !== nil && (!opal$a._isBoolean || opal$a == true))) {
            (opal$a = enumopal$).opal$yield.apply(opal$a, [].concat(args));
          }
          else {
            self.opal$raise(opal$scope.StopLazyError);
          }
        ;}, TMP_30._s = self, TMP_30), opal$a).call(opal$b, self, nil);
      };

      opal$opal.defn(self, 'opal$to_enum', def.opal$enum_for);

      return (def.opal$inspect = function() {
        var self = this;

        return "#<" + (self.opal$class().opal$name()) + ": " + (self.enumerator.opal$inspect()) + ">";
      }, nil) && 'inspect';
    })(self, self);
  })(self, null);
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass, opal$gvars = opal$opal.gvars, opal$range = opal$opal.range;

  ;
  return (function(opal$base, opal$super) {
    function opal$Array(){};
    var self = opal$Array = opal$klass(opal$base, opal$super, 'Array', opal$Array);

    var def = self._proto, opal$scope = self._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_7, TMP_8, TMP_9, TMP_10, TMP_11, TMP_12, TMP_13, TMP_14, TMP_15, TMP_17, TMP_18, TMP_19, TMP_20, TMP_21, TMP_24;

    def.length = nil;
    self.opal$include(opal$scope.Enumerable);

    def._isArray = true;

    opal$opal.defs(self, 'opal$[]', function(objects) {
      var self = this;

      objects = opal$slice.call(arguments, 0);
      return objects;
    });

    def.opal$initialize = function(args) {
      var opal$a, self = this;

      args = opal$slice.call(arguments, 0);
      return (opal$a = self.opal$class()).opal$new.apply(opal$a, [].concat(args));
    };

    opal$opal.defs(self, 'opal$new', TMP_1 = function(size, obj) {
      var opal$a, self = this, opal$iter = TMP_1._p, block = opal$iter || nil;

      if (size == null) {
        size = nil
      }
      if (obj == null) {
        obj = nil
      }
      TMP_1._p = null;
      if (((opal$a = arguments.length > 2) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.ArgumentError, "wrong number of arguments (" + (arguments.length) + " for 0..2)")};
      if (((opal$a = arguments.length === 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return []};
      if (((opal$a = arguments.length === 1) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        if (((opal$a = opal$scope.Array['opal$==='](size)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          return size.opal$to_a()
        } else if (((opal$a = size['opal$respond_to?']("to_ary")) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          return size.opal$to_ary()}};
      size = opal$scope.Opal.opal$coerce_to(size, opal$scope.Integer, "to_int");
      if (((opal$a = size < 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.ArgumentError, "negative array size")};
      
      var result = [];

      if (block === nil) {
        for (var i = 0; i < size; i++) {
          result.push(obj);
        }
      }
      else {
        for (var i = 0, value; i < size; i++) {
          value = block(i);

          if (value === opal$breaker) {
            return opal$breaker.opal$v;
          }

          result[i] = value;
        }
      }

      return result;
    
    });

    opal$opal.defs(self, 'opal$try_convert', function(obj) {
      var self = this;

      return opal$scope.Opal['opal$coerce_to?'](obj, opal$scope.Array, "to_ary");
    });

    def['opal$&'] = function(other) {
      var opal$a, self = this;

      if (((opal$a = opal$scope.Array['opal$==='](other)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        other = other.opal$to_a()
        } else {
        other = opal$scope.Opal.opal$coerce_to(other, opal$scope.Array, "to_ary").opal$to_a()
      };
      
      var result = [],
          seen   = {};

      for (var i = 0, length = self.length; i < length; i++) {
        var item = self[i];

        if (!seen[item]) {
          for (var j = 0, length2 = other.length; j < length2; j++) {
            var item2 = other[j];

            if (!seen[item2] && (item)['opal$=='](item2)) {
              seen[item] = true;
              result.push(item);
            }
          }
        }
      }

      return result;
    
    };

    def['opal$*'] = function(other) {
      var opal$a, self = this;

      if (((opal$a = other['opal$respond_to?']("to_str")) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return self.join(other.opal$to_str())};
      if (((opal$a = other['opal$respond_to?']("to_int")) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.TypeError, "no implicit conversion of " + (other.opal$class()) + " into Integer")
      };
      other = opal$scope.Opal.opal$coerce_to(other, opal$scope.Integer, "to_int");
      if (((opal$a = other < 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.ArgumentError, "negative argument")};
      
      var result = [];

      for (var i = 0; i < other; i++) {
        result = result.concat(self);
      }

      return result;
    
    };

    def['opal$+'] = function(other) {
      var opal$a, self = this;

      if (((opal$a = opal$scope.Array['opal$==='](other)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        other = other.opal$to_a()
        } else {
        other = opal$scope.Opal.opal$coerce_to(other, opal$scope.Array, "to_ary").opal$to_a()
      };
      return self.concat(other);
    };

    def['opal$-'] = function(other) {
      var opal$a, self = this;

      if (((opal$a = opal$scope.Array['opal$==='](other)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        other = other.opal$to_a()
        } else {
        other = opal$scope.Opal.opal$coerce_to(other, opal$scope.Array, "to_ary").opal$to_a()
      };
      if (((opal$a = self.length === 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return []};
      if (((opal$a = other.length === 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return self.opal$clone()};
      
      var seen   = {},
          result = [];

      for (var i = 0, length = other.length; i < length; i++) {
        seen[other[i]] = true;
      }

      for (var i = 0, length = self.length; i < length; i++) {
        var item = self[i];

        if (!seen[item]) {
          result.push(item);
        }
      }

      return result;
    
    };

    def['opal$<<'] = function(object) {
      var self = this;

      self.push(object);
      return self;
    };

    def['opal$<=>'] = function(other) {
      var opal$a, self = this;

      if (((opal$a = opal$scope.Array['opal$==='](other)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        other = other.opal$to_a()
      } else if (((opal$a = other['opal$respond_to?']("to_ary")) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        other = other.opal$to_ary().opal$to_a()
        } else {
        return nil
      };
      
      if (self.opal$hash() === other.opal$hash()) {
        return 0;
      }

      if (self.length != other.length) {
        return (self.length > other.length) ? 1 : -1;
      }

      for (var i = 0, length = self.length; i < length; i++) {
        var tmp = (self[i])['opal$<=>'](other[i]);

        if (tmp !== 0) {
          return tmp;
        }
      }

      return 0;
    ;
    };

    def['opal$=='] = function(other) {
      var opal$a, self = this;

      if (((opal$a = self === other) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return true};
      if (((opal$a = opal$scope.Array['opal$==='](other)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        if (((opal$a = other['opal$respond_to?']("to_ary")) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          } else {
          return false
        };
        return other['opal$=='](self);
      };
      other = other.opal$to_a();
      if (((opal$a = self.length === other.length) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        return false
      };
      
      for (var i = 0, length = self.length; i < length; i++) {
        var a = self[i],
            b = other[i];

        if (a._isArray && b._isArray && (a === self)) {
          continue;
        }

        if (!(a)['opal$=='](b)) {
          return false;
        }
      }
    
      return true;
    };

    def['opal$[]'] = function(index, length) {
      var opal$a, self = this;

      if (((opal$a = opal$scope.Range['opal$==='](index)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        
        var size    = self.length,
            exclude = index.exclude,
            from    = opal$scope.Opal.opal$coerce_to(index.begin, opal$scope.Integer, "to_int"),
            to      = opal$scope.Opal.opal$coerce_to(index.end, opal$scope.Integer, "to_int");

        if (from < 0) {
          from += size;

          if (from < 0) {
            return nil;
          }
        }

        if (from > size) {
          return nil;
        }

        if (to < 0) {
          to += size;

          if (to < 0) {
            return [];
          }
        }

        if (!exclude) {
          to += 1;
        }

        return self.slice(from, to);
      ;
        } else {
        index = opal$scope.Opal.opal$coerce_to(index, opal$scope.Integer, "to_int");
        
        var size = self.length;

        if (index < 0) {
          index += size;

          if (index < 0) {
            return nil;
          }
        }

        if (length === undefined) {
          if (index >= size || index < 0) {
            return nil;
          }

          return self[index];
        }
        else {
          length = opal$scope.Opal.opal$coerce_to(length, opal$scope.Integer, "to_int");

          if (length < 0 || index > size || index < 0) {
            return nil;
          }

          return self.slice(index, index + length);
        }
      
      };
    };

    def['opal$[]='] = function(index, value, extra) {
      var opal$a, self = this, data = nil, length = nil;

      if (((opal$a = opal$scope.Range['opal$==='](index)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        if (((opal$a = opal$scope.Array['opal$==='](value)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          data = value.opal$to_a()
        } else if (((opal$a = value['opal$respond_to?']("to_ary")) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          data = value.opal$to_ary().opal$to_a()
          } else {
          data = [value]
        };
        
        var size    = self.length,
            exclude = index.exclude,
            from    = opal$scope.Opal.opal$coerce_to(index.begin, opal$scope.Integer, "to_int"),
            to      = opal$scope.Opal.opal$coerce_to(index.end, opal$scope.Integer, "to_int");

        if (from < 0) {
          from += size;

          if (from < 0) {
            self.opal$raise(opal$scope.RangeError, "" + (index.opal$inspect()) + " out of range");
          }
        }

        if (to < 0) {
          to += size;
        }

        if (!exclude) {
          to += 1;
        }

        if (from > size) {
          for (var i = size; i < from; i++) {
            self[i] = nil;
          }
        }

        if (to < 0) {
          self.splice.apply(self, [from, 0].concat(data));
        }
        else {
          self.splice.apply(self, [from, to - from].concat(data));
        }

        return value;
      ;
        } else {
        if (((opal$a = extra === undefined) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          length = 1
          } else {
          length = value;
          value = extra;
          if (((opal$a = opal$scope.Array['opal$==='](value)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
            data = value.opal$to_a()
          } else if (((opal$a = value['opal$respond_to?']("to_ary")) !== nil && (!opal$a._isBoolean || opal$a == true))) {
            data = value.opal$to_ary().opal$to_a()
            } else {
            data = [value]
          };
        };
        
        var size   = self.length,
            index  = opal$scope.Opal.opal$coerce_to(index, opal$scope.Integer, "to_int"),
            length = opal$scope.Opal.opal$coerce_to(length, opal$scope.Integer, "to_int"),
            old;

        if (index < 0) {
          old    = index;
          index += size;

          if (index < 0) {
            self.opal$raise(opal$scope.IndexError, "index " + (old) + " too small for array; minimum " + (-self.length));
          }
        }

        if (length < 0) {
          self.opal$raise(opal$scope.IndexError, "negative length (" + (length) + ")")
        }

        if (index > size) {
          for (var i = size; i < index; i++) {
            self[i] = nil;
          }
        }

        if (extra === undefined) {
          self[index] = value;
        }
        else {
          self.splice.apply(self, [index, length].concat(data));
        }

        return value;
      ;
      };
    };

    def.opal$assoc = function(object) {
      var self = this;

      
      for (var i = 0, length = self.length, item; i < length; i++) {
        if (item = self[i], item.length && (item[0])['opal$=='](object)) {
          return item;
        }
      }

      return nil;
    
    };

    def.opal$at = function(index) {
      var self = this;

      index = opal$scope.Opal.opal$coerce_to(index, opal$scope.Integer, "to_int");
      
      if (index < 0) {
        index += self.length;
      }

      if (index < 0 || index >= self.length) {
        return nil;
      }

      return self[index];
    
    };

    def.opal$cycle = TMP_2 = function(n) {
      var opal$a, opal$b, self = this, opal$iter = TMP_2._p, block = opal$iter || nil;

      if (n == null) {
        n = nil
      }
      TMP_2._p = null;
      if (((opal$a = (((opal$b = self['opal$empty?']()) !== false && opal$b !== nil) ? opal$b : n['opal$=='](0))) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return nil};
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("cycle", n)
      };
      if (((opal$a = n['opal$nil?']()) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        
        while (true) {
          for (var i = 0, length = self.length; i < length; i++) {
            var value = opal$opal.opal$yield1(block, self[i]);

            if (value === opal$breaker) {
              return opal$breaker.opal$v;
            }
          }
        }
      
        } else {
        n = opal$scope.Opal['opal$coerce_to!'](n, opal$scope.Integer, "to_int");
        
        if (n <= 0) {
          return self;
        }

        while (n > 0) {
          for (var i = 0, length = self.length; i < length; i++) {
            var value = opal$opal.opal$yield1(block, self[i]);

            if (value === opal$breaker) {
              return opal$breaker.opal$v;
            }
          }

          n--;
        }
      
      };
      return self;
    };

    def.opal$clear = function() {
      var self = this;

      self.splice(0, self.length);
      return self;
    };

    def.opal$clone = function() {
      var self = this, copy = nil;

      copy = [];
      copy.opal$initialize_clone(self);
      return copy;
    };

    def.opal$dup = function() {
      var self = this, copy = nil;

      copy = [];
      copy.opal$initialize_dup(self);
      return copy;
    };

    def.opal$initialize_copy = function(other) {
      var self = this;

      return self.opal$replace(other);
    };

    def.opal$collect = TMP_3 = function() {
      var self = this, opal$iter = TMP_3._p, block = opal$iter || nil;

      TMP_3._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("collect")
      };
      
      var result = [];

      for (var i = 0, length = self.length; i < length; i++) {
        var value = Opal.opal$yield1(block, self[i]);

        if (value === opal$breaker) {
          return opal$breaker.opal$v;
        }

        result.push(value);
      }

      return result;
    
    };

    def['opal$collect!'] = TMP_4 = function() {
      var self = this, opal$iter = TMP_4._p, block = opal$iter || nil;

      TMP_4._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("collect!")
      };
      
      for (var i = 0, length = self.length; i < length; i++) {
        var value = Opal.opal$yield1(block, self[i]);

        if (value === opal$breaker) {
          return opal$breaker.opal$v;
        }

        self[i] = value;
      }
    
      return self;
    };

    def.opal$compact = function() {
      var self = this;

      
      var result = [];

      for (var i = 0, length = self.length, item; i < length; i++) {
        if ((item = self[i]) !== nil) {
          result.push(item);
        }
      }

      return result;
    
    };

    def['opal$compact!'] = function() {
      var self = this;

      
      var original = self.length;

      for (var i = 0, length = self.length; i < length; i++) {
        if (self[i] === nil) {
          self.splice(i, 1);

          length--;
          i--;
        }
      }

      return self.length === original ? nil : self;
    
    };

    def.opal$concat = function(other) {
      var opal$a, self = this;

      if (((opal$a = opal$scope.Array['opal$==='](other)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        other = other.opal$to_a()
        } else {
        other = opal$scope.Opal.opal$coerce_to(other, opal$scope.Array, "to_ary").opal$to_a()
      };
      
      for (var i = 0, length = other.length; i < length; i++) {
        self.push(other[i]);
      }
    
      return self;
    };

    def.opal$delete = function(object) {
      var self = this;

      
      var original = self.length;

      for (var i = 0, length = original; i < length; i++) {
        if ((self[i])['opal$=='](object)) {
          self.splice(i, 1);

          length--;
          i--;
        }
      }

      return self.length === original ? nil : object;
    
    };

    def.opal$delete_at = function(index) {
      var self = this;

      
      index = opal$scope.Opal.opal$coerce_to(index, opal$scope.Integer, "to_int");

      if (index < 0) {
        index += self.length;
      }

      if (index < 0 || index >= self.length) {
        return nil;
      }

      var result = self[index];

      self.splice(index, 1);

      return result;
    ;
    };

    def.opal$delete_if = TMP_5 = function() {
      var self = this, opal$iter = TMP_5._p, block = opal$iter || nil;

      TMP_5._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("delete_if")
      };
      
      for (var i = 0, length = self.length, value; i < length; i++) {
        if ((value = block(self[i])) === opal$breaker) {
          return opal$breaker.opal$v;
        }

        if (value !== false && value !== nil) {
          self.splice(i, 1);

          length--;
          i--;
        }
      }
    
      return self;
    };

    def.opal$drop = function(number) {
      var self = this;

      
      if (number < 0) {
        self.opal$raise(opal$scope.ArgumentError)
      }

      return self.slice(number);
    ;
    };

    opal$opal.defn(self, 'opal$dup', def.opal$clone);

    def.opal$each = TMP_6 = function() {
      var self = this, opal$iter = TMP_6._p, block = opal$iter || nil;

      TMP_6._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("each")
      };
      
      for (var i = 0, length = self.length; i < length; i++) {
        var value = opal$opal.opal$yield1(block, self[i]);

        if (value == opal$breaker) {
          return opal$breaker.opal$v;
        }
      }
    
      return self;
    };

    def.opal$each_index = TMP_7 = function() {
      var self = this, opal$iter = TMP_7._p, block = opal$iter || nil;

      TMP_7._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("each_index")
      };
      
      for (var i = 0, length = self.length; i < length; i++) {
        var value = opal$opal.opal$yield1(block, i);

        if (value === opal$breaker) {
          return opal$breaker.opal$v;
        }
      }
    
      return self;
    };

    def['opal$empty?'] = function() {
      var self = this;

      return self.length === 0;
    };

    def['opal$eql?'] = function(other) {
      var opal$a, self = this;

      if (((opal$a = self === other) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return true};
      if (((opal$a = opal$scope.Array['opal$==='](other)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        return false
      };
      other = other.opal$to_a();
      if (((opal$a = self.length === other.length) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        return false
      };
      
      for (var i = 0, length = self.length; i < length; i++) {
        var a = self[i],
            b = other[i];

        if (a._isArray && b._isArray && (a === self)) {
          continue;
        }

        if (!(a)['opal$eql?'](b)) {
          return false;
        }
      }
    
      return true;
    };

    def.opal$fetch = TMP_8 = function(index, defaults) {
      var self = this, opal$iter = TMP_8._p, block = opal$iter || nil;

      TMP_8._p = null;
      
      var original = index;

      index = opal$scope.Opal.opal$coerce_to(index, opal$scope.Integer, "to_int");

      if (index < 0) {
        index += self.length;
      }

      if (index >= 0 && index < self.length) {
        return self[index];
      }

      if (block !== nil) {
        return block(original);
      }

      if (defaults != null) {
        return defaults;
      }

      if (self.length === 0) {
        self.opal$raise(opal$scope.IndexError, "index " + (original) + " outside of array bounds: 0...0")
      }
      else {
        self.opal$raise(opal$scope.IndexError, "index " + (original) + " outside of array bounds: -" + (self.length) + "..." + (self.length));
      }
    ;
    };

    def.opal$fill = TMP_9 = function(args) {
      var opal$a, self = this, opal$iter = TMP_9._p, block = opal$iter || nil, one = nil, two = nil, obj = nil, left = nil, right = nil;

      args = opal$slice.call(arguments, 0);
      TMP_9._p = null;
      if (block !== false && block !== nil) {
        if (((opal$a = args.length > 2) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          self.opal$raise(opal$scope.ArgumentError, "wrong number of arguments (" + (args.opal$length()) + " for 0..2)")};
        opal$a = opal$opal.to_ary(args), one = (opal$a[0] == null ? nil : opal$a[0]), two = (opal$a[1] == null ? nil : opal$a[1]);
        } else {
        if (((opal$a = args.length == 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          self.opal$raise(opal$scope.ArgumentError, "wrong number of arguments (0 for 1..3)")
        } else if (((opal$a = args.length > 3) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          self.opal$raise(opal$scope.ArgumentError, "wrong number of arguments (" + (args.opal$length()) + " for 1..3)")};
        opal$a = opal$opal.to_ary(args), obj = (opal$a[0] == null ? nil : opal$a[0]), one = (opal$a[1] == null ? nil : opal$a[1]), two = (opal$a[2] == null ? nil : opal$a[2]);
      };
      if (((opal$a = opal$scope.Range['opal$==='](one)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        if (two !== false && two !== nil) {
          self.opal$raise(opal$scope.TypeError, "length invalid with range")};
        left = opal$scope.Opal.opal$coerce_to(one.opal$begin(), opal$scope.Integer, "to_int");
        if (((opal$a = left < 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          left += self.length;};
        if (((opal$a = left < 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          self.opal$raise(opal$scope.RangeError, "" + (one.opal$inspect()) + " out of range")};
        right = opal$scope.Opal.opal$coerce_to(one.opal$end(), opal$scope.Integer, "to_int");
        if (((opal$a = right < 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          right += self.length;};
        if (((opal$a = one['opal$exclude_end?']()) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          } else {
          right += 1;
        };
        if (((opal$a = right <= left) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          return self};
      } else if (one !== false && one !== nil) {
        left = opal$scope.Opal.opal$coerce_to(one, opal$scope.Integer, "to_int");
        if (((opal$a = left < 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          left += self.length;};
        if (((opal$a = left < 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          left = 0};
        if (two !== false && two !== nil) {
          right = opal$scope.Opal.opal$coerce_to(two, opal$scope.Integer, "to_int");
          if (((opal$a = right == 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
            return self};
          right += left;
          } else {
          right = self.length
        };
        } else {
        left = 0;
        right = self.length;
      };
      if (((opal$a = left > self.length) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        
        for (var i = self.length; i < right; i++) {
          self[i] = nil;
        }
      ;};
      if (((opal$a = right > self.length) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.length = right};
      if (block !== false && block !== nil) {
        
        for (var length = self.length; left < right; left++) {
          var value = block(left);

          if (value === opal$breaker) {
            return opal$breaker.opal$v;
          }

          self[left] = value;
        }
      ;
        } else {
        
        for (var length = self.length; left < right; left++) {
          self[left] = obj;
        }
      ;
      };
      return self;
    };

    def.opal$first = function(count) {
      var self = this;

      
      if (count == null) {
        return self.length === 0 ? nil : self[0];
      }

      count = opal$scope.Opal.opal$coerce_to(count, opal$scope.Integer, "to_int");

      if (count < 0) {
        self.opal$raise(opal$scope.ArgumentError, "negative array size");
      }

      return self.slice(0, count);
    
    };

    def.opal$flatten = function(level) {
      var self = this;

      
      var result = [];

      for (var i = 0, length = self.length; i < length; i++) {
        var item = self[i];

        if (opal$scope.Opal['opal$respond_to?'](item, "to_ary")) {
          item = (item).opal$to_ary();

          if (level == null) {
            result.push.apply(result, (item).opal$flatten().opal$to_a());
          }
          else if (level == 0) {
            result.push(item);
          }
          else {
            result.push.apply(result, (item).opal$flatten(level - 1).opal$to_a());
          }
        }
        else {
          result.push(item);
        }
      }

      return result;
    ;
    };

    def['opal$flatten!'] = function(level) {
      var self = this;

      
      var flattened = self.opal$flatten(level);

      if (self.length == flattened.length) {
        for (var i = 0, length = self.length; i < length; i++) {
          if (self[i] !== flattened[i]) {
            break;
          }
        }

        if (i == length) {
          return nil;
        }
      }

      self.opal$replace(flattened);
    ;
      return self;
    };

    def.opal$hash = function() {
      var self = this;

      return self._id || (self._id = Opal.uid());
    };

    def['opal$include?'] = function(member) {
      var self = this;

      
      for (var i = 0, length = self.length; i < length; i++) {
        if ((self[i])['opal$=='](member)) {
          return true;
        }
      }

      return false;
    
    };

    def.opal$index = TMP_10 = function(object) {
      var self = this, opal$iter = TMP_10._p, block = opal$iter || nil;

      TMP_10._p = null;
      
      if (object != null) {
        for (var i = 0, length = self.length; i < length; i++) {
          if ((self[i])['opal$=='](object)) {
            return i;
          }
        }
      }
      else if (block !== nil) {
        for (var i = 0, length = self.length, value; i < length; i++) {
          if ((value = block(self[i])) === opal$breaker) {
            return opal$breaker.opal$v;
          }

          if (value !== false && value !== nil) {
            return i;
          }
        }
      }
      else {
        return self.opal$enum_for("index");
      }

      return nil;
    
    };

    def.opal$insert = function(index, objects) {
      var self = this;

      objects = opal$slice.call(arguments, 1);
      
      index = opal$scope.Opal.opal$coerce_to(index, opal$scope.Integer, "to_int");

      if (objects.length > 0) {
        if (index < 0) {
          index += self.length + 1;

          if (index < 0) {
            self.opal$raise(opal$scope.IndexError, "" + (index) + " is out of bounds");
          }
        }
        if (index > self.length) {
          for (var i = self.length; i < index; i++) {
            self.push(nil);
          }
        }

        self.splice.apply(self, [index, 0].concat(objects));
      }
    ;
      return self;
    };

    def.opal$inspect = function() {
      var self = this;

      
      var i, inspect, el, el_insp, length, object_id;

      inspect = [];
      object_id = self.opal$object_id();
      length = self.length;

      for (i = 0; i < length; i++) {
        el = self['opal$[]'](i);

        // Check object_id to ensure it's not the same array get into an infinite loop
        el_insp = (el).opal$object_id() === object_id ? '[...]' : (el).opal$inspect();

        inspect.push(el_insp);
      }
      return '[' + inspect.join(', ') + ']';
    ;
    };

    def.opal$join = function(sep) {
      var opal$a, self = this;
      if (opal$gvars[","] == null) opal$gvars[","] = nil;

      if (sep == null) {
        sep = nil
      }
      if (((opal$a = self.length === 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return ""};
      if (((opal$a = sep === nil) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        sep = opal$gvars[","]};
      
      var result = [];

      for (var i = 0, length = self.length; i < length; i++) {
        var item = self[i];

        if (opal$scope.Opal['opal$respond_to?'](item, "to_str")) {
          var tmp = (item).opal$to_str();

          if (tmp !== nil) {
            result.push((tmp).opal$to_s());

            continue;
          }
        }

        if (opal$scope.Opal['opal$respond_to?'](item, "to_ary")) {
          var tmp = (item).opal$to_ary();

          if (tmp !== nil) {
            result.push((tmp).opal$join(sep));

            continue;
          }
        }

        if (opal$scope.Opal['opal$respond_to?'](item, "to_s")) {
          var tmp = (item).opal$to_s();

          if (tmp !== nil) {
            result.push(tmp);

            continue;
          }
        }

        self.opal$raise(opal$scope.NoMethodError, "" + (opal$scope.Opal.opal$inspect(item)) + " doesn't respond to #to_str, #to_ary or #to_s");
      }

      if (sep === nil) {
        return result.join('');
      }
      else {
        return result.join(opal$scope.Opal['opal$coerce_to!'](sep, opal$scope.String, "to_str").opal$to_s());
      }
    ;
    };

    def.opal$keep_if = TMP_11 = function() {
      var self = this, opal$iter = TMP_11._p, block = opal$iter || nil;

      TMP_11._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("keep_if")
      };
      
      for (var i = 0, length = self.length, value; i < length; i++) {
        if ((value = block(self[i])) === opal$breaker) {
          return opal$breaker.opal$v;
        }

        if (value === false || value === nil) {
          self.splice(i, 1);

          length--;
          i--;
        }
      }
    
      return self;
    };

    def.opal$last = function(count) {
      var self = this;

      
      if (count == null) {
        return self.length === 0 ? nil : self[self.length - 1];
      }

      count = opal$scope.Opal.opal$coerce_to(count, opal$scope.Integer, "to_int");

      if (count < 0) {
        self.opal$raise(opal$scope.ArgumentError, "negative array size");
      }

      if (count > self.length) {
        count = self.length;
      }

      return self.slice(self.length - count, self.length);
    
    };

    def.opal$length = function() {
      var self = this;

      return self.length;
    };

    opal$opal.defn(self, 'opal$map', def.opal$collect);

    opal$opal.defn(self, 'opal$map!', def['opal$collect!']);

    def.opal$pop = function(count) {
      var opal$a, self = this;

      if (((opal$a = count === undefined) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        if (((opal$a = self.length === 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          return nil};
        return self.pop();};
      count = opal$scope.Opal.opal$coerce_to(count, opal$scope.Integer, "to_int");
      if (((opal$a = count < 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.ArgumentError, "negative array size")};
      if (((opal$a = self.length === 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return []};
      if (((opal$a = count > self.length) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return self.splice(0, self.length);
        } else {
        return self.splice(self.length - count, self.length);
      };
    };

    def.opal$push = function(objects) {
      var self = this;

      objects = opal$slice.call(arguments, 0);
      
      for (var i = 0, length = objects.length; i < length; i++) {
        self.push(objects[i]);
      }
    
      return self;
    };

    def.opal$rassoc = function(object) {
      var self = this;

      
      for (var i = 0, length = self.length, item; i < length; i++) {
        item = self[i];

        if (item.length && item[1] !== undefined) {
          if ((item[1])['opal$=='](object)) {
            return item;
          }
        }
      }

      return nil;
    
    };

    def.opal$reject = TMP_12 = function() {
      var self = this, opal$iter = TMP_12._p, block = opal$iter || nil;

      TMP_12._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("reject")
      };
      
      var result = [];

      for (var i = 0, length = self.length, value; i < length; i++) {
        if ((value = block(self[i])) === opal$breaker) {
          return opal$breaker.opal$v;
        }

        if (value === false || value === nil) {
          result.push(self[i]);
        }
      }
      return result;
    
    };

    def['opal$reject!'] = TMP_13 = function() {
      var opal$a, opal$b, self = this, opal$iter = TMP_13._p, block = opal$iter || nil, original = nil;

      TMP_13._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("reject!")
      };
      original = self.opal$length();
      (opal$a = (opal$b = self).opal$delete_if, opal$a._p = block.opal$to_proc(), opal$a).call(opal$b);
      if (self.opal$length()['opal$=='](original)) {
        return nil
        } else {
        return self
      };
    };

    def.opal$replace = function(other) {
      var opal$a, self = this;

      if (((opal$a = opal$scope.Array['opal$==='](other)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        other = other.opal$to_a()
        } else {
        other = opal$scope.Opal.opal$coerce_to(other, opal$scope.Array, "to_ary").opal$to_a()
      };
      
      self.splice(0, self.length);
      self.push.apply(self, other);
    
      return self;
    };

    def.opal$reverse = function() {
      var self = this;

      return self.slice(0).reverse();
    };

    def['opal$reverse!'] = function() {
      var self = this;

      return self.reverse();
    };

    def.opal$reverse_each = TMP_14 = function() {
      var opal$a, opal$b, self = this, opal$iter = TMP_14._p, block = opal$iter || nil;

      TMP_14._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("reverse_each")
      };
      (opal$a = (opal$b = self.opal$reverse()).opal$each, opal$a._p = block.opal$to_proc(), opal$a).call(opal$b);
      return self;
    };

    def.opal$rindex = TMP_15 = function(object) {
      var self = this, opal$iter = TMP_15._p, block = opal$iter || nil;

      TMP_15._p = null;
      
      if (object != null) {
        for (var i = self.length - 1; i >= 0; i--) {
          if ((self[i])['opal$=='](object)) {
            return i;
          }
        }
      }
      else if (block !== nil) {
        for (var i = self.length - 1, value; i >= 0; i--) {
          if ((value = block(self[i])) === opal$breaker) {
            return opal$breaker.opal$v;
          }

          if (value !== false && value !== nil) {
            return i;
          }
        }
      }
      else if (object == null) {
        return self.opal$enum_for("rindex");
      }

      return nil;
    
    };

    def.opal$sample = function(n) {
      var opal$a, opal$b, TMP_16, self = this;

      if (n == null) {
        n = nil
      }
      if (((opal$a = (opal$b = n['opal$!'](), opal$b !== false && opal$b !== nil ?self['opal$empty?']() : opal$b)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return nil};
      if (((opal$a = ((opal$b = n !== false && n !== nil) ? self['opal$empty?']() : opal$b)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return []};
      if (n !== false && n !== nil) {
        return (opal$a = (opal$b = (opal$range(1, n, false))).opal$map, opal$a._p = (TMP_16 = function(){var self = TMP_16._s || this;

        return self['opal$[]'](self.opal$rand(self.opal$length()))}, TMP_16._s = self, TMP_16), opal$a).call(opal$b)
        } else {
        return self['opal$[]'](self.opal$rand(self.opal$length()))
      };
    };

    def.opal$select = TMP_17 = function() {
      var self = this, opal$iter = TMP_17._p, block = opal$iter || nil;

      TMP_17._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("select")
      };
      
      var result = [];

      for (var i = 0, length = self.length, item, value; i < length; i++) {
        item = self[i];

        if ((value = opal$opal.opal$yield1(block, item)) === opal$breaker) {
          return opal$breaker.opal$v;
        }

        if (value !== false && value !== nil) {
          result.push(item);
        }
      }

      return result;
    
    };

    def['opal$select!'] = TMP_18 = function() {
      var opal$a, opal$b, self = this, opal$iter = TMP_18._p, block = opal$iter || nil;

      TMP_18._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("select!")
      };
      
      var original = self.length;
      (opal$a = (opal$b = self).opal$keep_if, opal$a._p = block.opal$to_proc(), opal$a).call(opal$b);
      return self.length === original ? nil : self;
    
    };

    def.opal$shift = function(count) {
      var opal$a, self = this;

      if (((opal$a = count === undefined) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        if (((opal$a = self.length === 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          return nil};
        return self.shift();};
      count = opal$scope.Opal.opal$coerce_to(count, opal$scope.Integer, "to_int");
      if (((opal$a = count < 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.ArgumentError, "negative array size")};
      if (((opal$a = self.length === 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return []};
      return self.splice(0, count);
    };

    opal$opal.defn(self, 'opal$size', def.opal$length);

    def.opal$shuffle = function() {
      var self = this;

      return self.opal$clone()['opal$shuffle!']();
    };

    def['opal$shuffle!'] = function() {
      var self = this;

      
      for (var i = self.length - 1; i > 0; i--) {
        var tmp = self[i],
            j   = Math.floor(Math.random() * (i + 1));

        self[i] = self[j];
        self[j] = tmp;
      }
    
      return self;
    };

    opal$opal.defn(self, 'opal$slice', def['opal$[]']);

    def['opal$slice!'] = function(index, length) {
      var self = this;

      
      if (index < 0) {
        index += self.length;
      }

      if (length != null) {
        return self.splice(index, length);
      }

      if (index < 0 || index >= self.length) {
        return nil;
      }

      return self.splice(index, 1)[0];
    
    };

    def.opal$sort = TMP_19 = function() {
      var opal$a, self = this, opal$iter = TMP_19._p, block = opal$iter || nil;

      TMP_19._p = null;
      if (((opal$a = self.length > 1) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        return self
      };
      
      if (!(block !== nil)) {
        block = function(a, b) {
          return (a)['opal$<=>'](b);
        };
      }

      try {
        return self.slice().sort(function(x, y) {
          var ret = block(x, y);

          if (ret === opal$breaker) {
            throw opal$breaker;
          }
          else if (ret === nil) {
            self.opal$raise(opal$scope.ArgumentError, "comparison of " + ((x).opal$inspect()) + " with " + ((y).opal$inspect()) + " failed");
          }

          return (ret)['opal$>'](0) ? 1 : ((ret)['opal$<'](0) ? -1 : 0);
        });
      }
      catch (e) {
        if (e === opal$breaker) {
          return opal$breaker.opal$v;
        }
        else {
          throw e;
        }
      }
    ;
    };

    def['opal$sort!'] = TMP_20 = function() {
      var opal$a, opal$b, self = this, opal$iter = TMP_20._p, block = opal$iter || nil;

      TMP_20._p = null;
      
      var result;

      if ((block !== nil)) {
        result = (opal$a = (opal$b = (self.slice())).opal$sort, opal$a._p = block.opal$to_proc(), opal$a).call(opal$b);
      }
      else {
        result = (self.slice()).opal$sort();
      }

      self.length = 0;
      for(var i = 0, length = result.length; i < length; i++) {
        self.push(result[i]);
      }

      return self;
    ;
    };

    def.opal$take = function(count) {
      var self = this;

      
      if (count < 0) {
        self.opal$raise(opal$scope.ArgumentError);
      }

      return self.slice(0, count);
    ;
    };

    def.opal$take_while = TMP_21 = function() {
      var self = this, opal$iter = TMP_21._p, block = opal$iter || nil;

      TMP_21._p = null;
      
      var result = [];

      for (var i = 0, length = self.length, item, value; i < length; i++) {
        item = self[i];

        if ((value = block(item)) === opal$breaker) {
          return opal$breaker.opal$v;
        }

        if (value === false || value === nil) {
          return result;
        }

        result.push(item);
      }

      return result;
    
    };

    def.opal$to_a = function() {
      var self = this;

      return self;
    };

    opal$opal.defn(self, 'opal$to_ary', def.opal$to_a);

    opal$opal.defn(self, 'opal$to_s', def.opal$inspect);

    def.opal$transpose = function() {
      var opal$a, opal$b, TMP_22, self = this, result = nil, max = nil;

      if (((opal$a = self['opal$empty?']()) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return []};
      result = [];
      max = nil;
      (opal$a = (opal$b = self).opal$each, opal$a._p = (TMP_22 = function(row){var self = TMP_22._s || this, opal$a, opal$b, TMP_23;
if (row == null) row = nil;
      if (((opal$a = opal$scope.Array['opal$==='](row)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          row = row.opal$to_a()
          } else {
          row = opal$scope.Opal.opal$coerce_to(row, opal$scope.Array, "to_ary").opal$to_a()
        };
        (((opal$a = max) !== false && opal$a !== nil) ? opal$a : max = row.length);
        if (((opal$a = (row.length)['opal$=='](max)['opal$!']()) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          self.opal$raise(opal$scope.IndexError, "element size differs (" + (row.length) + " should be " + (max))};
        return (opal$a = (opal$b = (row.length)).opal$times, opal$a._p = (TMP_23 = function(i){var self = TMP_23._s || this, opal$a, opal$b, opal$c, entry = nil;
if (i == null) i = nil;
        entry = ((opal$a = i, opal$b = result, (((opal$c = opal$b['opal$[]'](opal$a)) !== false && opal$c !== nil) ? opal$c : opal$b['opal$[]='](opal$a, []))));
          return entry['opal$<<'](row.opal$at(i));}, TMP_23._s = self, TMP_23), opal$a).call(opal$b);}, TMP_22._s = self, TMP_22), opal$a).call(opal$b);
      return result;
    };

    def.opal$uniq = function() {
      var self = this;

      
      var result = [],
          seen   = {};

      for (var i = 0, length = self.length, item, hash; i < length; i++) {
        item = self[i];
        hash = item;

        if (!seen[hash]) {
          seen[hash] = true;

          result.push(item);
        }
      }

      return result;
    
    };

    def['opal$uniq!'] = function() {
      var self = this;

      
      var original = self.length,
          seen     = {};

      for (var i = 0, length = original, item, hash; i < length; i++) {
        item = self[i];
        hash = item;

        if (!seen[hash]) {
          seen[hash] = true;
        }
        else {
          self.splice(i, 1);

          length--;
          i--;
        }
      }

      return self.length === original ? nil : self;
    
    };

    def.opal$unshift = function(objects) {
      var self = this;

      objects = opal$slice.call(arguments, 0);
      
      for (var i = objects.length - 1; i >= 0; i--) {
        self.unshift(objects[i]);
      }
    
      return self;
    };

    return (def.opal$zip = TMP_24 = function(others) {
      var self = this, opal$iter = TMP_24._p, block = opal$iter || nil;

      others = opal$slice.call(arguments, 0);
      TMP_24._p = null;
      
      var result = [], size = self.length, part, o;

      for (var i = 0; i < size; i++) {
        part = [self[i]];

        for (var j = 0, jj = others.length; j < jj; j++) {
          o = others[j][i];

          if (o == null) {
            o = nil;
          }

          part[j + 1] = o;
        }

        result[i] = part;
      }

      if (block !== nil) {
        for (var i = 0; i < size; i++) {
          block(result[i]);
        }

        return nil;
      }

      return result;
    
    }, nil) && 'zip';
  })(self, null);
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass;

  (function(opal$base, opal$super) {
    function opal$Array(){};
    var self = opal$Array = opal$klass(opal$base, opal$super, 'Array', opal$Array);

    var def = self._proto, opal$scope = self._scope;

    return (opal$opal.defs(self, 'opal$inherited', function(klass) {
      var self = this, replace = nil;

      replace = opal$scope.Class.opal$new((opal$scope.Array)._scope.Wrapper);
      
      klass._proto        = replace._proto;
      klass._proto._klass = klass;
      klass._alloc        = replace._alloc;
      klass.__parent      = (opal$scope.Array)._scope.Wrapper;

      klass.opal$allocate = replace.opal$allocate;
      klass.opal$new      = replace.opal$new;
      klass["opal$[]"]    = replace["opal$[]"];
    
    }), nil) && 'inherited'
  })(self, null);
  return (function(opal$base, opal$super) {
    function opal$Wrapper(){};
    var self = opal$Wrapper = opal$klass(opal$base, opal$super, 'Wrapper', opal$Wrapper);

    var def = self._proto, opal$scope = self._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5;

    def.literal = nil;
    opal$opal.defs(self, 'opal$allocate', TMP_1 = function(array) {
      var self = this, opal$iter = TMP_1._p, opal$yield = opal$iter || nil, obj = nil;

      if (array == null) {
        array = []
      }
      TMP_1._p = null;
      obj = opal$opal.find_super_dispatcher(self, 'allocate', TMP_1, null, opal$Wrapper).apply(self, []);
      obj.literal = array;
      return obj;
    });

    opal$opal.defs(self, 'opal$new', TMP_2 = function(args) {
      var opal$a, opal$b, self = this, opal$iter = TMP_2._p, block = opal$iter || nil, obj = nil;

      args = opal$slice.call(arguments, 0);
      TMP_2._p = null;
      obj = self.opal$allocate();
      (opal$a = (opal$b = obj).opal$initialize, opal$a._p = block.opal$to_proc(), opal$a).apply(opal$b, [].concat(args));
      return obj;
    });

    opal$opal.defs(self, 'opal$[]', function(objects) {
      var self = this;

      objects = opal$slice.call(arguments, 0);
      return self.opal$allocate(objects);
    });

    def.opal$initialize = TMP_3 = function(args) {
      var opal$a, opal$b, self = this, opal$iter = TMP_3._p, block = opal$iter || nil;

      args = opal$slice.call(arguments, 0);
      TMP_3._p = null;
      return self.literal = (opal$a = (opal$b = opal$scope.Array).opal$new, opal$a._p = block.opal$to_proc(), opal$a).apply(opal$b, [].concat(args));
    };

    def.opal$method_missing = TMP_4 = function(args) {
      var opal$a, opal$b, self = this, opal$iter = TMP_4._p, block = opal$iter || nil, result = nil;

      args = opal$slice.call(arguments, 0);
      TMP_4._p = null;
      result = (opal$a = (opal$b = self.literal).opal$__send__, opal$a._p = block.opal$to_proc(), opal$a).apply(opal$b, [].concat(args));
      if (((opal$a = result === self.literal) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return self
        } else {
        return result
      };
    };

    def.opal$initialize_copy = function(other) {
      var self = this;

      return self.literal = (other.literal).opal$clone();
    };

    def['opal$respond_to?'] = TMP_5 = function(name) {var opal$zuper = opal$slice.call(arguments, 0);
      var opal$a, self = this, opal$iter = TMP_5._p, opal$yield = opal$iter || nil;

      TMP_5._p = null;
      return (((opal$a = opal$opal.find_super_dispatcher(self, 'respond_to?', TMP_5, opal$iter).apply(self, opal$zuper)) !== false && opal$a !== nil) ? opal$a : self.literal['opal$respond_to?'](name));
    };

    def['opal$=='] = function(other) {
      var self = this;

      return self.literal['opal$=='](other);
    };

    def['opal$eql?'] = function(other) {
      var self = this;

      return self.literal['opal$eql?'](other);
    };

    def.opal$to_a = function() {
      var self = this;

      return self.literal;
    };

    def.opal$to_ary = function() {
      var self = this;

      return self;
    };

    def.opal$inspect = function() {
      var self = this;

      return self.literal.opal$inspect();
    };

    def['opal$*'] = function(other) {
      var self = this;

      
      var result = self.literal['opal$*'](other);

      if (result._isArray) {
        return self.opal$class().opal$allocate(result)
      }
      else {
        return result;
      }
    ;
    };

    def['opal$[]'] = function(index, length) {
      var self = this;

      
      var result = self.literal.opal$slice(index, length);

      if (result._isArray && (index._isRange || length !== undefined)) {
        return self.opal$class().opal$allocate(result)
      }
      else {
        return result;
      }
    ;
    };

    opal$opal.defn(self, 'opal$slice', def['opal$[]']);

    def.opal$uniq = function() {
      var self = this;

      return self.opal$class().opal$allocate(self.literal.opal$uniq());
    };

    return (def.opal$flatten = function(level) {
      var self = this;

      return self.opal$class().opal$allocate(self.literal.opal$flatten(level));
    }, nil) && 'flatten';
  })(opal$scope.Array, null);
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass;

  ;
  return (function(opal$base, opal$super) {
    function opal$Hash(){};
    var self = opal$Hash = opal$klass(opal$base, opal$super, 'Hash', opal$Hash);

    var def = self._proto, opal$scope = self._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_7, TMP_8, TMP_9, TMP_10, TMP_11, TMP_12, TMP_13;

    def.proc = def.none = nil;
    self.opal$include(opal$scope.Enumerable);

    opal$opal.defs(self, 'opal$[]', function(objs) {
      var self = this;

      objs = opal$slice.call(arguments, 0);
      return opal$opal.hash.apply(null, objs);
    });

    opal$opal.defs(self, 'opal$allocate', function() {
      var self = this;

      
      var hash = new self._alloc;

      hash.map  = {};
      hash.keys = [];
      hash.none = nil;
      hash.proc = nil;

      return hash;
    
    });

    def.opal$initialize = TMP_1 = function(defaults) {
      var self = this, opal$iter = TMP_1._p, block = opal$iter || nil;

      TMP_1._p = null;
      
      self.none = (defaults === undefined ? nil : defaults);
      self.proc = block;
    
      return self;
    };

    def['opal$=='] = function(other) {
      var self = this;

      
      if (self === other) {
        return true;
      }

      if (!other.map || !other.keys) {
        return false;
      }

      if (self.keys.length !== other.keys.length) {
        return false;
      }

      var map  = self.map,
          map2 = other.map;

      for (var i = 0, length = self.keys.length; i < length; i++) {
        var key = self.keys[i], obj = map[key], obj2 = map2[key];
        if (obj2 === undefined || (obj)['opal$=='](obj2)['opal$!']()) {
          return false;
        }
      }

      return true;
    
    };

    def['opal$[]'] = function(key) {
      var self = this;

      
      var map = self.map;

      if (opal$opal.hasOwnProperty.call(map, key)) {
        return map[key];
      }

      var proc = self.proc;

      if (proc !== nil) {
        return (proc).opal$call(self, key);
      }

      return self.none;
    
    };

    def['opal$[]='] = function(key, value) {
      var self = this;

      
      var map = self.map;

      if (!opal$opal.hasOwnProperty.call(map, key)) {
        self.keys.push(key);
      }

      map[key] = value;

      return value;
    
    };

    def.opal$assoc = function(object) {
      var self = this;

      
      var keys = self.keys, key;

      for (var i = 0, length = keys.length; i < length; i++) {
        key = keys[i];

        if ((key)['opal$=='](object)) {
          return [key, self.map[key]];
        }
      }

      return nil;
    
    };

    def.opal$clear = function() {
      var self = this;

      
      self.map = {};
      self.keys = [];
      return self;
    
    };

    def.opal$clone = function() {
      var self = this;

      
      var map  = {},
          keys = [];

      for (var i = 0, length = self.keys.length; i < length; i++) {
        var key   = self.keys[i],
            value = self.map[key];

        keys.push(key);
        map[key] = value;
      }

      var hash = new self._klass._alloc();

      hash.map  = map;
      hash.keys = keys;
      hash.none = self.none;
      hash.proc = self.proc;

      return hash;
    
    };

    def.opal$default = function(val) {
      var self = this;

      
      if (val !== undefined && self.proc !== nil) {
        return self.proc.opal$call(self, val);
      }
      return self.none;
    ;
    };

    def['opal$default='] = function(object) {
      var self = this;

      
      self.proc = nil;
      return (self.none = object);
    
    };

    def.opal$default_proc = function() {
      var self = this;

      return self.proc;
    };

    def['opal$default_proc='] = function(proc) {
      var self = this;

      
      if (proc !== nil) {
        proc = opal$scope.Opal['opal$coerce_to!'](proc, opal$scope.Proc, "to_proc");

        if (proc['opal$lambda?']() && proc.opal$arity().opal$abs() != 2) {
          self.opal$raise(opal$scope.TypeError, "default_proc takes two arguments");
        }
      }
      self.none = nil;
      return (self.proc = proc);
    ;
    };

    def.opal$delete = TMP_2 = function(key) {
      var self = this, opal$iter = TMP_2._p, block = opal$iter || nil;

      TMP_2._p = null;
      
      var map  = self.map, result = map[key];

      if (result != null) {
        delete map[key];
        self.keys.opal$delete(key);

        return result;
      }

      if (block !== nil) {
        return block.opal$call(key);
      }
      return nil;
    
    };

    def.opal$delete_if = TMP_3 = function() {
      var self = this, opal$iter = TMP_3._p, block = opal$iter || nil;

      TMP_3._p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("delete_if")
      };
      
      var map = self.map, keys = self.keys, value;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((value = block(key, obj)) === opal$breaker) {
          return opal$breaker.opal$v;
        }

        if (value !== false && value !== nil) {
          keys.splice(i, 1);
          delete map[key];

          length--;
          i--;
        }
      }

      return self;
    
    };

    opal$opal.defn(self, 'opal$dup', def.opal$clone);

    def.opal$each = TMP_4 = function() {
      var self = this, opal$iter = TMP_4._p, block = opal$iter || nil;

      TMP_4._p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("each")
      };
      
      var map  = self.map,
          keys = self.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key   = keys[i],
            value = opal$opal.opal$yield1(block, [key, map[key]]);

        if (value === opal$breaker) {
          return opal$breaker.opal$v;
        }
      }

      return self;
    
    };

    def.opal$each_key = TMP_5 = function() {
      var self = this, opal$iter = TMP_5._p, block = opal$iter || nil;

      TMP_5._p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("each_key")
      };
      
      var keys = self.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        if (block(key) === opal$breaker) {
          return opal$breaker.opal$v;
        }
      }

      return self;
    
    };

    opal$opal.defn(self, 'opal$each_pair', def.opal$each);

    def.opal$each_value = TMP_6 = function() {
      var self = this, opal$iter = TMP_6._p, block = opal$iter || nil;

      TMP_6._p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("each_value")
      };
      
      var map = self.map, keys = self.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        if (block(map[keys[i]]) === opal$breaker) {
          return opal$breaker.opal$v;
        }
      }

      return self;
    
    };

    def['opal$empty?'] = function() {
      var self = this;

      return self.keys.length === 0;
    };

    opal$opal.defn(self, 'opal$eql?', def['opal$==']);

    def.opal$fetch = TMP_7 = function(key, defaults) {
      var self = this, opal$iter = TMP_7._p, block = opal$iter || nil;

      TMP_7._p = null;
      
      var value = self.map[key];

      if (value != null) {
        return value;
      }

      if (block !== nil) {
        var value;

        if ((value = block(key)) === opal$breaker) {
          return opal$breaker.opal$v;
        }

        return value;
      }

      if (defaults != null) {
        return defaults;
      }

      self.opal$raise(opal$scope.KeyError, "key not found");
    
    };

    def.opal$flatten = function(level) {
      var self = this;

      
      var map = self.map, keys = self.keys, result = [];

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], value = map[key];

        result.push(key);

        if (value._isArray) {
          if (level == null || level === 1) {
            result.push(value);
          }
          else {
            result = result.concat((value).opal$flatten(level - 1));
          }
        }
        else {
          result.push(value);
        }
      }

      return result;
    
    };

    def['opal$has_key?'] = function(key) {
      var self = this;

      return opal$opal.hasOwnProperty.call(self.map, key);
    };

    def['opal$has_value?'] = function(value) {
      var self = this;

      
      for (var assoc in self.map) {
        if ((self.map[assoc])['opal$=='](value)) {
          return true;
        }
      }

      return false;
    ;
    };

    def.opal$hash = function() {
      var self = this;

      return self._id;
    };

    opal$opal.defn(self, 'opal$include?', def['opal$has_key?']);

    def.opal$index = function(object) {
      var self = this;

      
      var map = self.map, keys = self.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        if ((map[key])['opal$=='](object)) {
          return key;
        }
      }

      return nil;
    
    };

    def.opal$indexes = function(keys) {
      var self = this;

      keys = opal$slice.call(arguments, 0);
      
      var result = [], map = self.map, val;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], val = map[key];

        if (val != null) {
          result.push(val);
        }
        else {
          result.push(self.none);
        }
      }

      return result;
    
    };

    opal$opal.defn(self, 'opal$indices', def.opal$indexes);

    def.opal$inspect = function() {
      var self = this;

      
      var inspect = [], keys = self.keys, map = self.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], val = map[key];

        if (val === self) {
          inspect.push((key).opal$inspect() + '=>' + '{...}');
        } else {
          inspect.push((key).opal$inspect() + '=>' + (map[key]).opal$inspect());
        }
      }

      return '{' + inspect.join(', ') + '}';
    ;
    };

    def.opal$invert = function() {
      var self = this;

      
      var result = opal$opal.hash(), keys = self.keys, map = self.map,
          keys2 = result.keys, map2 = result.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        keys2.push(obj);
        map2[obj] = key;
      }

      return result;
    
    };

    def.opal$keep_if = TMP_8 = function() {
      var self = this, opal$iter = TMP_8._p, block = opal$iter || nil;

      TMP_8._p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("keep_if")
      };
      
      var map = self.map, keys = self.keys, value;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((value = block(key, obj)) === opal$breaker) {
          return opal$breaker.opal$v;
        }

        if (value === false || value === nil) {
          keys.splice(i, 1);
          delete map[key];

          length--;
          i--;
        }
      }

      return self;
    
    };

    opal$opal.defn(self, 'opal$key', def.opal$index);

    opal$opal.defn(self, 'opal$key?', def['opal$has_key?']);

    def.opal$keys = function() {
      var self = this;

      return self.keys.slice(0);
    };

    def.opal$length = function() {
      var self = this;

      return self.keys.length;
    };

    opal$opal.defn(self, 'opal$member?', def['opal$has_key?']);

    def.opal$merge = TMP_9 = function(other) {
      var self = this, opal$iter = TMP_9._p, block = opal$iter || nil;

      TMP_9._p = null;
      
      if (! opal$scope.Hash['opal$==='](other)) {
        other = opal$scope.Opal['opal$coerce_to!'](other, opal$scope.Hash, "to_hash");
      }

      var keys = self.keys, map = self.map,
          result = opal$opal.hash(), keys2 = result.keys, map2 = result.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        keys2.push(key);
        map2[key] = map[key];
      }

      var keys = other.keys, map = other.map;

      if (block === nil) {
        for (var i = 0, length = keys.length; i < length; i++) {
          var key = keys[i];

          if (map2[key] == null) {
            keys2.push(key);
          }

          map2[key] = map[key];
        }
      }
      else {
        for (var i = 0, length = keys.length; i < length; i++) {
          var key = keys[i];

          if (map2[key] == null) {
            keys2.push(key);
            map2[key] = map[key];
          }
          else {
            map2[key] = block(key, map2[key], map[key]);
          }
        }
      }

      return result;
    ;
    };

    def['opal$merge!'] = TMP_10 = function(other) {
      var self = this, opal$iter = TMP_10._p, block = opal$iter || nil;

      TMP_10._p = null;
      
      if (! opal$scope.Hash['opal$==='](other)) {
        other = opal$scope.Opal['opal$coerce_to!'](other, opal$scope.Hash, "to_hash");
      }

      var keys = self.keys, map = self.map,
          keys2 = other.keys, map2 = other.map;

      if (block === nil) {
        for (var i = 0, length = keys2.length; i < length; i++) {
          var key = keys2[i];

          if (map[key] == null) {
            keys.push(key);
          }

          map[key] = map2[key];
        }
      }
      else {
        for (var i = 0, length = keys2.length; i < length; i++) {
          var key = keys2[i];

          if (map[key] == null) {
            keys.push(key);
            map[key] = map2[key];
          }
          else {
            map[key] = block(key, map[key], map2[key]);
          }
        }
      }

      return self;
    ;
    };

    def.opal$rassoc = function(object) {
      var self = this;

      
      var keys = self.keys, map = self.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((obj)['opal$=='](object)) {
          return [key, obj];
        }
      }

      return nil;
    
    };

    def.opal$reject = TMP_11 = function() {
      var self = this, opal$iter = TMP_11._p, block = opal$iter || nil;

      TMP_11._p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("reject")
      };
      
      var keys = self.keys, map = self.map,
          result = opal$opal.hash(), map2 = result.map, keys2 = result.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key], value;

        if ((value = block(key, obj)) === opal$breaker) {
          return opal$breaker.opal$v;
        }

        if (value === false || value === nil) {
          keys2.push(key);
          map2[key] = obj;
        }
      }

      return result;
    
    };

    def.opal$replace = function(other) {
      var self = this;

      
      var map = self.map = {}, keys = self.keys = [];

      for (var i = 0, length = other.keys.length; i < length; i++) {
        var key = other.keys[i];
        keys.push(key);
        map[key] = other.map[key];
      }

      return self;
    
    };

    def.opal$select = TMP_12 = function() {
      var self = this, opal$iter = TMP_12._p, block = opal$iter || nil;

      TMP_12._p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("select")
      };
      
      var keys = self.keys, map = self.map,
          result = opal$opal.hash(), map2 = result.map, keys2 = result.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key], value;

        if ((value = block(key, obj)) === opal$breaker) {
          return opal$breaker.opal$v;
        }

        if (value !== false && value !== nil) {
          keys2.push(key);
          map2[key] = obj;
        }
      }

      return result;
    
    };

    def['opal$select!'] = TMP_13 = function() {
      var self = this, opal$iter = TMP_13._p, block = opal$iter || nil;

      TMP_13._p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("select!")
      };
      
      var map = self.map, keys = self.keys, value, result = nil;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((value = block(key, obj)) === opal$breaker) {
          return opal$breaker.opal$v;
        }

        if (value === false || value === nil) {
          keys.splice(i, 1);
          delete map[key];

          length--;
          i--;
          result = self
        }
      }

      return result;
    
    };

    def.opal$shift = function() {
      var self = this;

      
      var keys = self.keys, map = self.map;

      if (keys.length) {
        var key = keys[0], obj = map[key];

        delete map[key];
        keys.splice(0, 1);

        return [key, obj];
      }

      return nil;
    
    };

    opal$opal.defn(self, 'opal$size', def.opal$length);

    self.opal$alias_method("store", "[]=");

    def.opal$to_a = function() {
      var self = this;

      
      var keys = self.keys, map = self.map, result = [];

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];
        result.push([key, map[key]]);
      }

      return result;
    
    };

    def.opal$to_h = function() {
      var self = this;

      
      var hash   = new Opal.Hash._alloc,
          cloned = self.opal$clone();

      hash.map  = cloned.map;
      hash.keys = cloned.keys;
      hash.none = cloned.none;
      hash.proc = cloned.proc;

      return hash;
    ;
    };

    def.opal$to_hash = function() {
      var self = this;

      return self;
    };

    opal$opal.defn(self, 'opal$to_s', def.opal$inspect);

    opal$opal.defn(self, 'opal$update', def['opal$merge!']);

    opal$opal.defn(self, 'opal$value?', def['opal$has_value?']);

    opal$opal.defn(self, 'opal$values_at', def.opal$indexes);

    return (def.opal$values = function() {
      var self = this;

      
      var map    = self.map,
          result = [];

      for (var key in map) {
        result.push(map[key]);
      }

      return result;
    
    }, nil) && 'values';
  })(self, null);
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass, opal$gvars = opal$opal.gvars;

  ;
  (function(opal$base, opal$super) {
    function opal$String(){};
    var self = opal$String = opal$klass(opal$base, opal$super, 'String', opal$String);

    var def = self._proto, opal$scope = self._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_7;

    def.length = nil;
    self.opal$include(opal$scope.Comparable);

    def._isString = true;

    opal$opal.defs(self, 'opal$try_convert', function(what) {
      var self = this;

      try {
      return what.opal$to_str()
      } catch (opal$err) {if (true) {
        return nil
        }else { throw opal$err; }
      };
    });

    opal$opal.defs(self, 'opal$new', function(str) {
      var self = this;

      if (str == null) {
        str = ""
      }
      return new String(str);
    });

    def['opal$%'] = function(data) {
      var opal$a, self = this;

      if (((opal$a = opal$scope.Array['opal$==='](data)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return (opal$a = self).opal$format.apply(opal$a, [self].concat(data))
        } else {
        return self.opal$format(self, data)
      };
    };

    def['opal$*'] = function(count) {
      var self = this;

      
      if (count < 1) {
        return '';
      }

      var result  = '',
          pattern = self;

      while (count > 0) {
        if (count & 1) {
          result += pattern;
        }

        count >>= 1;
        pattern += pattern;
      }

      return result;
    
    };

    def['opal$+'] = function(other) {
      var self = this;

      other = opal$scope.Opal.opal$coerce_to(other, opal$scope.String, "to_str");
      return self + other.opal$to_s();
    };

    def['opal$<=>'] = function(other) {
      var opal$a, self = this;

      if (((opal$a = other['opal$respond_to?']("to_str")) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        other = other.opal$to_str().opal$to_s();
        return self > other ? 1 : (self < other ? -1 : 0);
        } else {
        
        var cmp = other['opal$<=>'](self);

        if (cmp === nil) {
          return nil;
        }
        else {
          return cmp > 0 ? -1 : (cmp < 0 ? 1 : 0);
        }
      ;
      };
    };

    def['opal$=='] = function(other) {
      var opal$a, self = this;

      if (((opal$a = opal$scope.String['opal$==='](other)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        return false
      };
      return self.opal$to_s() == other.opal$to_s();
    };

    opal$opal.defn(self, 'opal$eql?', def['opal$==']);

    opal$opal.defn(self, 'opal$===', def['opal$==']);

    def['opal$=~'] = function(other) {
      var self = this;

      
      if (other._isString) {
        self.opal$raise(opal$scope.TypeError, "type mismatch: String given");
      }

      return other['opal$=~'](self);
    ;
    };

    def['opal$[]'] = function(index, length) {
      var self = this;

      
      var size = self.length;

      if (index._isRange) {
        var exclude = index.exclude,
            length  = index.end,
            index   = index.begin;

        if (index < 0) {
          index += size;
        }

        if (length < 0) {
          length += size;
        }

        if (!exclude) {
          length += 1;
        }

        if (index > size) {
          return nil;
        }

        length = length - index;

        if (length < 0) {
          length = 0;
        }

        return self.substr(index, length);
      }

      if (index < 0) {
        index += self.length;
      }

      if (length == null) {
        if (index >= self.length || index < 0) {
          return nil;
        }

        return self.substr(index, 1);
      }

      if (index > self.length || index < 0) {
        return nil;
      }

      return self.substr(index, length);
    
    };

    def.opal$capitalize = function() {
      var self = this;

      return self.charAt(0).toUpperCase() + self.substr(1).toLowerCase();
    };

    def.opal$casecmp = function(other) {
      var self = this;

      other = opal$scope.Opal.opal$coerce_to(other, opal$scope.String, "to_str").opal$to_s();
      return (self.toLowerCase())['opal$<=>'](other.toLowerCase());
    };

    def.opal$center = function(width, padstr) {
      var opal$a, self = this;

      if (padstr == null) {
        padstr = " "
      }
      width = opal$scope.Opal.opal$coerce_to(width, opal$scope.Integer, "to_int");
      padstr = opal$scope.Opal.opal$coerce_to(padstr, opal$scope.String, "to_str").opal$to_s();
      if (((opal$a = padstr['opal$empty?']()) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.ArgumentError, "zero width padding")};
      if (((opal$a = width <= self.length) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return self};
      
      var ljustified = self.opal$ljust((width['opal$+'](self.length))['opal$/'](2).opal$ceil(), padstr),
          rjustified = self.opal$rjust((width['opal$+'](self.length))['opal$/'](2).opal$floor(), padstr);

      return rjustified + ljustified.slice(self.length);
    ;
    };

    def.opal$chars = TMP_1 = function() {
      var opal$a, opal$b, self = this, opal$iter = TMP_1._p, block = opal$iter || nil;

      TMP_1._p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.opal$each_char().opal$to_a()
      };
      return (opal$a = (opal$b = self).opal$each_char, opal$a._p = block.opal$to_proc(), opal$a).call(opal$b);
    };

    def.opal$chomp = function(separator) {
      var opal$a, self = this;
      if (opal$gvars["/"] == null) opal$gvars["/"] = nil;

      if (separator == null) {
        separator = opal$gvars["/"]
      }
      if (((opal$a = separator === nil || self.length === 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return self};
      separator = opal$scope.Opal['opal$coerce_to!'](separator, opal$scope.String, "to_str").opal$to_s();
      
      if (separator === "\n") {
        return self.replace(/\r?\n?opal$/, '');
      }
      else if (separator === "") {
        return self.replace(/(\r?\n)+opal$/, '');
      }
      else if (self.length > separator.length) {
        var tail = self.substr(self.length - separator.length, separator.length);

        if (tail === separator) {
          return self.substr(0, self.length - separator.length);
        }
      }
    
      return self;
    };

    def.opal$chop = function() {
      var self = this;

      
      var length = self.length;

      if (length <= 1) {
        return "";
      }

      if (self.charAt(length - 1) === "\n" && self.charAt(length - 2) === "\r") {
        return self.substr(0, length - 2);
      }
      else {
        return self.substr(0, length - 1);
      }
    
    };

    def.opal$chr = function() {
      var self = this;

      return self.charAt(0);
    };

    def.opal$clone = function() {
      var self = this, copy = nil;

      copy = self.slice();
      copy.opal$initialize_clone(self);
      return copy;
    };

    def.opal$dup = function() {
      var self = this, copy = nil;

      copy = self.slice();
      copy.opal$initialize_dup(self);
      return copy;
    };

    def.opal$count = function(str) {
      var self = this;

      return (self.length - self.replace(new RegExp(str, 'g'), '').length) / str.length;
    };

    opal$opal.defn(self, 'opal$dup', def.opal$clone);

    def.opal$downcase = function() {
      var self = this;

      return self.toLowerCase();
    };

    def.opal$each_char = TMP_2 = function() {
      var opal$a, self = this, opal$iter = TMP_2._p, block = opal$iter || nil;

      TMP_2._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("each_char")
      };
      
      for (var i = 0, length = self.length; i < length; i++) {
        (((opal$a = opal$opal.opal$yield1(block, self.charAt(i))) === opal$breaker) ? opal$breaker.opal$v : opal$a);
      }
    
      return self;
    };

    def.opal$each_line = TMP_3 = function(separator) {
      var opal$a, self = this, opal$iter = TMP_3._p, opal$yield = opal$iter || nil;
      if (opal$gvars["/"] == null) opal$gvars["/"] = nil;

      if (separator == null) {
        separator = opal$gvars["/"]
      }
      TMP_3._p = null;
      if ((opal$yield !== nil)) {
        } else {
        return self.opal$split(separator)
      };
      
      var chomped  = self.opal$chomp(),
          trailing = self.length != chomped.length,
          splitted = chomped.split(separator);

      for (var i = 0, length = splitted.length; i < length; i++) {
        if (i < length - 1 || trailing) {
          (((opal$a = opal$opal.opal$yield1(opal$yield, splitted[i] + separator)) === opal$breaker) ? opal$breaker.opal$v : opal$a);
        }
        else {
          (((opal$a = opal$opal.opal$yield1(opal$yield, splitted[i])) === opal$breaker) ? opal$breaker.opal$v : opal$a);
        }
      }
    ;
      return self;
    };

    def['opal$empty?'] = function() {
      var self = this;

      return self.length === 0;
    };

    def['opal$end_with?'] = function(suffixes) {
      var self = this;

      suffixes = opal$slice.call(arguments, 0);
      
      for (var i = 0, length = suffixes.length; i < length; i++) {
        var suffix = opal$scope.Opal.opal$coerce_to(suffixes[i], opal$scope.String, "to_str").opal$to_s();

        if (self.length >= suffix.length &&
            self.substr(self.length - suffix.length, suffix.length) == suffix) {
          return true;
        }
      }
    
      return false;
    };

    opal$opal.defn(self, 'opal$eql?', def['opal$==']);

    opal$opal.defn(self, 'opal$equal?', def['opal$===']);

    def.opal$gsub = TMP_4 = function(pattern, replace) {
      var opal$a, opal$b, self = this, opal$iter = TMP_4._p, block = opal$iter || nil;

      TMP_4._p = null;
      if (((opal$a = (((opal$b = opal$scope.String['opal$==='](pattern)) !== false && opal$b !== nil) ? opal$b : pattern['opal$respond_to?']("to_str"))) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        pattern = (new RegExp("" + opal$scope.Regexp.opal$escape(pattern.opal$to_str())))};
      if (((opal$a = opal$scope.Regexp['opal$==='](pattern)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.TypeError, "wrong argument type " + (pattern.opal$class()) + " (expected Regexp)")
      };
      
      var pattern = pattern.toString(),
          options = pattern.substr(pattern.lastIndexOf('/') + 1) + 'g',
          regexp  = pattern.substr(1, pattern.lastIndexOf('/') - 1);

      self.opal$sub._p = block;
      return self.opal$sub(new RegExp(regexp, options), replace);
    
    };

    def.opal$hash = function() {
      var self = this;

      return self.toString();
    };

    def.opal$hex = function() {
      var self = this;

      return self.opal$to_i(16);
    };

    def['opal$include?'] = function(other) {
      var opal$a, self = this;

      
      if (other._isString) {
        return self.indexOf(other) !== -1;
      }
    
      if (((opal$a = other['opal$respond_to?']("to_str")) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.TypeError, "no implicit conversion of " + (other.opal$class().opal$name()) + " into String")
      };
      return self.indexOf(other.opal$to_str()) !== -1;
    };

    def.opal$index = function(what, offset) {
      var opal$a, self = this, result = nil;

      if (offset == null) {
        offset = nil
      }
      if (((opal$a = opal$scope.String['opal$==='](what)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        what = what.opal$to_s()
      } else if (((opal$a = what['opal$respond_to?']("to_str")) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        what = what.opal$to_str().opal$to_s()
      } else if (((opal$a = opal$scope.Regexp['opal$==='](what)['opal$!']()) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.TypeError, "type mismatch: " + (what.opal$class()) + " given")};
      result = -1;
      if (offset !== false && offset !== nil) {
        offset = opal$scope.Opal.opal$coerce_to(offset, opal$scope.Integer, "to_int");
        
        var size = self.length;

        if (offset < 0) {
          offset = offset + size;
        }

        if (offset > size) {
          return nil;
        }
      
        if (((opal$a = opal$scope.Regexp['opal$==='](what)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          result = (((opal$a = (what['opal$=~'](self.substr(offset)))) !== false && opal$a !== nil) ? opal$a : -1)
          } else {
          result = self.substr(offset).indexOf(what)
        };
        
        if (result !== -1) {
          result += offset;
        }
      
      } else if (((opal$a = opal$scope.Regexp['opal$==='](what)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        result = (((opal$a = (what['opal$=~'](self))) !== false && opal$a !== nil) ? opal$a : -1)
        } else {
        result = self.indexOf(what)
      };
      if (((opal$a = result === -1) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return nil
        } else {
        return result
      };
    };

    def.opal$inspect = function() {
      var self = this;

      
      var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
          meta      = {
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
          };

      escapable.lastIndex = 0;

      return escapable.test(self) ? '"' + self.replace(escapable, function(a) {
        var c = meta[a];

        return typeof c === 'string' ? c :
          '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
      }) + '"' : '"' + self + '"';
    
    };

    def.opal$intern = function() {
      var self = this;

      return self;
    };

    def.opal$lines = function(separator) {
      var self = this;
      if (opal$gvars["/"] == null) opal$gvars["/"] = nil;

      if (separator == null) {
        separator = opal$gvars["/"]
      }
      return self.opal$each_line(separator).opal$to_a();
    };

    def.opal$length = function() {
      var self = this;

      return self.length;
    };

    def.opal$ljust = function(width, padstr) {
      var opal$a, self = this;

      if (padstr == null) {
        padstr = " "
      }
      width = opal$scope.Opal.opal$coerce_to(width, opal$scope.Integer, "to_int");
      padstr = opal$scope.Opal.opal$coerce_to(padstr, opal$scope.String, "to_str").opal$to_s();
      if (((opal$a = padstr['opal$empty?']()) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.ArgumentError, "zero width padding")};
      if (((opal$a = width <= self.length) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return self};
      
      var index  = -1,
          result = "";

      width -= self.length;

      while (++index < width) {
        result += padstr;
      }

      return self + result.slice(0, width);
    
    };

    def.opal$lstrip = function() {
      var self = this;

      return self.replace(/^\s*/, '');
    };

    def.opal$match = TMP_5 = function(pattern, pos) {
      var opal$a, opal$b, self = this, opal$iter = TMP_5._p, block = opal$iter || nil;

      TMP_5._p = null;
      if (((opal$a = (((opal$b = opal$scope.String['opal$==='](pattern)) !== false && opal$b !== nil) ? opal$b : pattern['opal$respond_to?']("to_str"))) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        pattern = (new RegExp("" + opal$scope.Regexp.opal$escape(pattern.opal$to_str())))};
      if (((opal$a = opal$scope.Regexp['opal$==='](pattern)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.TypeError, "wrong argument type " + (pattern.opal$class()) + " (expected Regexp)")
      };
      return (opal$a = (opal$b = pattern).opal$match, opal$a._p = block.opal$to_proc(), opal$a).call(opal$b, self, pos);
    };

    def.opal$next = function() {
      var self = this;

      
      if (self.length === 0) {
        return "";
      }

      var initial = self.substr(0, self.length - 1);
      var last    = String.fromCharCode(self.charCodeAt(self.length - 1) + 1);

      return initial + last;
    
    };

    def.opal$ord = function() {
      var self = this;

      return self.charCodeAt(0);
    };

    def.opal$partition = function(str) {
      var self = this;

      
      var result = self.split(str);
      var splitter = (result[0].length === self.length ? "" : str);

      return [result[0], splitter, result.slice(1).join(str.toString())];
    
    };

    def.opal$reverse = function() {
      var self = this;

      return self.split('').reverse().join('');
    };

    def.opal$rindex = function(search, offset) {
      var self = this;

      
      var search_type = (search == null ? Opal.NilClass : search.constructor);
      if (search_type != String && search_type != RegExp) {
        var msg = "type mismatch: " + search_type + " given";
        self.opal$raise(opal$scope.TypeError.opal$new(msg));
      }

      if (self.length == 0) {
        return search.length == 0 ? 0 : nil;
      }

      var result = -1;
      if (offset != null) {
        if (offset < 0) {
          offset = self.length + offset;
        }

        if (search_type == String) {
          result = self.lastIndexOf(search, offset);
        }
        else {
          result = self.substr(0, offset + 1).opal$reverse().search(search);
          if (result !== -1) {
            result = offset - result;
          }
        }
      }
      else {
        if (search_type == String) {
          result = self.lastIndexOf(search);
        }
        else {
          result = self.opal$reverse().search(search);
          if (result !== -1) {
            result = self.length - 1 - result;
          }
        }
      }

      return result === -1 ? nil : result;
    
    };

    def.opal$rjust = function(width, padstr) {
      var opal$a, self = this;

      if (padstr == null) {
        padstr = " "
      }
      width = opal$scope.Opal.opal$coerce_to(width, opal$scope.Integer, "to_int");
      padstr = opal$scope.Opal.opal$coerce_to(padstr, opal$scope.String, "to_str").opal$to_s();
      if (((opal$a = padstr['opal$empty?']()) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.ArgumentError, "zero width padding")};
      if (((opal$a = width <= self.length) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return self};
      
      var chars     = Math.floor(width - self.length),
          patterns  = Math.floor(chars / padstr.length),
          result    = Array(patterns + 1).join(padstr),
          remaining = chars - result.length;

      return result + padstr.slice(0, remaining) + self;
    
    };

    def.opal$rstrip = function() {
      var self = this;

      return self.replace(/\s*opal$/, '');
    };

    def.opal$scan = TMP_6 = function(pattern) {
      var self = this, opal$iter = TMP_6._p, block = opal$iter || nil;

      TMP_6._p = null;
      
      if (pattern.global) {
        // should we clear it afterwards too?
        pattern.lastIndex = 0;
      }
      else {
        // rewrite regular expression to add the global flag to capture pre/post match
        pattern = new RegExp(pattern.source, 'g' + (pattern.multiline ? 'm' : '') + (pattern.ignoreCase ? 'i' : ''));
      }

      var result = [];
      var match;

      while ((match = pattern.exec(self)) != null) {
        var match_data = opal$scope.MatchData.opal$new(pattern, match);
        if (block === nil) {
          match.length == 1 ? result.push(match[0]) : result.push(match.slice(1));
        }
        else {
          match.length == 1 ? block(match[0]) : block.apply(self, match.slice(1));
        }
      }

      return (block !== nil ? self : result);
    
    };

    opal$opal.defn(self, 'opal$size', def.opal$length);

    opal$opal.defn(self, 'opal$slice', def['opal$[]']);

    def.opal$split = function(pattern, limit) {
      var self = this, opal$a;
      if (opal$gvars[";"] == null) opal$gvars[";"] = nil;

      if (pattern == null) {
        pattern = (((opal$a = opal$gvars[";"]) !== false && opal$a !== nil) ? opal$a : " ")
      }
      
      if (pattern === nil || pattern === undefined) {
        pattern = opal$gvars[";"];
      }

      var result = [];
      if (limit !== undefined) {
        limit = opal$scope.Opal['opal$coerce_to!'](limit, opal$scope.Integer, "to_int");
      }

      if (self.length === 0) {
        return [];
      }

      if (limit === 1) {
        return [self];
      }

      if (pattern && pattern._isRegexp) {
        var pattern_str = pattern.toString();

        /* Opal and JS's repr of an empty RE. */
        var blank_pattern = (pattern_str.substr(0, 3) == '/^/') ||
                  (pattern_str.substr(0, 6) == '/(?:)/');

        /* This is our fast path */
        if (limit === undefined || limit === 0) {
          result = self.split(blank_pattern ? /(?:)/ : pattern);
        }
        else {
          /* RegExp.exec only has sane behavior with global flag */
          if (! pattern.global) {
            pattern = eval(pattern_str + 'g');
          }

          var match_data;
          var prev_index = 0;
          pattern.lastIndex = 0;

          while ((match_data = pattern.exec(self)) !== null) {
            var segment = self.slice(prev_index, match_data.index);
            result.push(segment);

            prev_index = pattern.lastIndex;

            if (match_data[0].length === 0) {
              if (blank_pattern) {
                /* explicitly split on JS's empty RE form.*/
                pattern = /(?:)/;
              }

              result = self.split(pattern);
              /* with "unlimited", ruby leaves a trail on blanks. */
              if (limit !== undefined && limit < 0 && blank_pattern) {
                result.push('');
              }

              prev_index = undefined;
              break;
            }

            if (limit !== undefined && limit > 1 && result.length + 1 == limit) {
              break;
            }
          }

          if (prev_index !== undefined) {
            result.push(self.slice(prev_index, self.length));
          }
        }
      }
      else {
        var splitted = 0, start = 0, lim = 0;

        if (pattern === nil || pattern === undefined) {
          pattern = ' '
        } else {
          pattern = opal$scope.Opal.opal$try_convert(pattern, opal$scope.String, "to_str").opal$to_s();
        }

        var string = (pattern == ' ') ? self.replace(/[\r\n\t\v]\s+/g, ' ')
                                      : self;
        var cursor = -1;
        while ((cursor = string.indexOf(pattern, start)) > -1 && cursor < string.length) {
          if (splitted + 1 === limit) {
            break;
          }

          if (pattern == ' ' && cursor == start) {
            start = cursor + 1;
            continue;
          }

          result.push(string.substr(start, pattern.length ? cursor - start : 1));
          splitted++;

          start = cursor + (pattern.length ? pattern.length : 1);
        }

        if (string.length > 0 && (limit < 0 || string.length > start)) {
          if (string.length == start) {
            result.push('');
          }
          else {
            result.push(string.substr(start, string.length));
          }
        }
      }

      if (limit === undefined || limit === 0) {
        while (result[result.length-1] === '') {
          result.length = result.length - 1;
        }
      }

      if (limit > 0) {
        var tail = result.slice(limit - 1).join('');
        result.splice(limit - 1, result.length - 1, tail);
      }

      return result;
    ;
    };

    def.opal$squeeze = function(sets) {
      var self = this;

      sets = opal$slice.call(arguments, 0);
      
      if (sets.length === 0) {
        return self.replace(/(.)\1+/g, 'opal$1');
      }
    
      
      var set = opal$scope.Opal.opal$coerce_to(sets[0], opal$scope.String, "to_str").opal$chars();

      for (var i = 1, length = sets.length; i < length; i++) {
        set = (set)['opal$&'](opal$scope.Opal.opal$coerce_to(sets[i], opal$scope.String, "to_str").opal$chars());
      }

      if (set.length === 0) {
        return self;
      }

      return self.replace(new RegExp("([" + opal$scope.Regexp.opal$escape((set).opal$join()) + "])\\1+", "g"), "opal$1");
    ;
    };

    def['opal$start_with?'] = function(prefixes) {
      var self = this;

      prefixes = opal$slice.call(arguments, 0);
      
      for (var i = 0, length = prefixes.length; i < length; i++) {
        var prefix = opal$scope.Opal.opal$coerce_to(prefixes[i], opal$scope.String, "to_str").opal$to_s();

        if (self.indexOf(prefix) === 0) {
          return true;
        }
      }

      return false;
    
    };

    def.opal$strip = function() {
      var self = this;

      return self.replace(/^\s*/, '').replace(/\s*opal$/, '');
    };

    def.opal$sub = TMP_7 = function(pattern, replace) {
      var self = this, opal$iter = TMP_7._p, block = opal$iter || nil;

      TMP_7._p = null;
      
      if (typeof(replace) === 'string') {
        // convert Ruby back reference to JavaScript back reference
        replace = replace.replace(/\\([1-9])/g, 'opal$opal$opal$1')
        return self.replace(pattern, replace);
      }
      if (block !== nil) {
        return self.replace(pattern, function() {
          // FIXME: this should be a formal MatchData object with all the goodies
          var match_data = []
          for (var i = 0, len = arguments.length; i < len; i++) {
            var arg = arguments[i];
            if (arg == undefined) {
              match_data.push(nil);
            }
            else {
              match_data.push(arg);
            }
          }

          var str = match_data.pop();
          var offset = match_data.pop();
          var match_len = match_data.length;

          // opal$1, opal$2, opal$3 not being parsed correctly in Ruby code
          //for (var i = 1; i < match_len; i++) {
          //  __gvars[String(i)] = match_data[i];
          //}
          opal$gvars["&"] = match_data[0];
          opal$gvars["~"] = match_data;
          return block(match_data[0]);
        });
      }
      else if (replace !== undefined) {
        if (replace['opal$is_a?'](opal$scope.Hash)) {
          return self.replace(pattern, function(str) {
            var value = replace['opal$[]'](self.opal$str());

            return (value == null) ? nil : self.opal$value().opal$to_s();
          });
        }
        else {
          replace = opal$scope.String.opal$try_convert(replace);

          if (replace == null) {
            self.opal$raise(opal$scope.TypeError, "can't convert " + (replace.opal$class()) + " into String");
          }

          return self.replace(pattern, replace);
        }
      }
      else {
        // convert Ruby back reference to JavaScript back reference
        replace = replace.toString().replace(/\\([1-9])/g, 'opal$opal$opal$1')
        return self.replace(pattern, replace);
      }
    ;
    };

    opal$opal.defn(self, 'opal$succ', def.opal$next);

    def.opal$sum = function(n) {
      var self = this;

      if (n == null) {
        n = 16
      }
      
      var result = 0;

      for (var i = 0, length = self.length; i < length; i++) {
        result += (self.charCodeAt(i) % ((1 << n) - 1));
      }

      return result;
    
    };

    def.opal$swapcase = function() {
      var self = this;

      
      var str = self.replace(/([a-z]+)|([A-Z]+)/g, function(opal$0,opal$1,opal$2) {
        return opal$1 ? opal$0.toUpperCase() : opal$0.toLowerCase();
      });

      if (self.constructor === String) {
        return str;
      }

      return self.opal$class().opal$new(str);
    
    };

    def.opal$to_f = function() {
      var self = this;

      
      if (self.charAt(0) === '_') {
        return 0;
      }

      var result = parseFloat(self.replace(/_/g, ''));

      if (isNaN(result) || result == Infinity || result == -Infinity) {
        return 0;
      }
      else {
        return result;
      }
    
    };

    def.opal$to_i = function(base) {
      var self = this;

      if (base == null) {
        base = 10
      }
      
      var result = parseInt(self, base);

      if (isNaN(result)) {
        return 0;
      }

      return result;
    
    };

    def.opal$to_proc = function() {
      var opal$a, opal$b, TMP_8, self = this;

      return (opal$a = (opal$b = self).opal$proc, opal$a._p = (TMP_8 = function(recv, args){var self = TMP_8._s || this, opal$a;
if (recv == null) recv = nil;args = opal$slice.call(arguments, 1);
      return (opal$a = recv).opal$send.apply(opal$a, [self].concat(args))}, TMP_8._s = self, TMP_8), opal$a).call(opal$b);
    };

    def.opal$to_s = function() {
      var self = this;

      return self.toString();
    };

    opal$opal.defn(self, 'opal$to_str', def.opal$to_s);

    opal$opal.defn(self, 'opal$to_sym', def.opal$intern);

    def.opal$tr = function(from, to) {
      var self = this;

      
      if (from.length == 0 || from === to) {
        return self;
      }

      var subs = {};
      var from_chars = from.split('');
      var from_length = from_chars.length;
      var to_chars = to.split('');
      var to_length = to_chars.length;

      var inverse = false;
      var global_sub = null;
      if (from_chars[0] === '^') {
        inverse = true;
        from_chars.shift();
        global_sub = to_chars[to_length - 1]
        from_length -= 1;
      }

      var from_chars_expanded = [];
      var last_from = null;
      var in_range = false;
      for (var i = 0; i < from_length; i++) {
        var ch = from_chars[i];
        if (last_from == null) {
          last_from = ch;
          from_chars_expanded.push(ch);
        }
        else if (ch === '-') {
          if (last_from === '-') {
            from_chars_expanded.push('-');
            from_chars_expanded.push('-');
          }
          else if (i == from_length - 1) {
            from_chars_expanded.push('-');
          }
          else {
            in_range = true;
          }
        }
        else if (in_range) {
          var start = last_from.charCodeAt(0) + 1;
          var end = ch.charCodeAt(0);
          for (var c = start; c < end; c++) {
            from_chars_expanded.push(String.fromCharCode(c));
          }
          from_chars_expanded.push(ch);
          in_range = null;
          last_from = null;
        }
        else {
          from_chars_expanded.push(ch);
        }
      }

      from_chars = from_chars_expanded;
      from_length = from_chars.length;

      if (inverse) {
        for (var i = 0; i < from_length; i++) {
          subs[from_chars[i]] = true;
        }
      }
      else {
        if (to_length > 0) {
          var to_chars_expanded = [];
          var last_to = null;
          var in_range = false;
          for (var i = 0; i < to_length; i++) {
            var ch = to_chars[i];
            if (last_from == null) {
              last_from = ch;
              to_chars_expanded.push(ch);
            }
            else if (ch === '-') {
              if (last_to === '-') {
                to_chars_expanded.push('-');
                to_chars_expanded.push('-');
              }
              else if (i == to_length - 1) {
                to_chars_expanded.push('-');
              }
              else {
                in_range = true;
              }
            }
            else if (in_range) {
              var start = last_from.charCodeAt(0) + 1;
              var end = ch.charCodeAt(0);
              for (var c = start; c < end; c++) {
                to_chars_expanded.push(String.fromCharCode(c));
              }
              to_chars_expanded.push(ch);
              in_range = null;
              last_from = null;
            }
            else {
              to_chars_expanded.push(ch);
            }
          }

          to_chars = to_chars_expanded;
          to_length = to_chars.length;
        }

        var length_diff = from_length - to_length;
        if (length_diff > 0) {
          var pad_char = (to_length > 0 ? to_chars[to_length - 1] : '');
          for (var i = 0; i < length_diff; i++) {
            to_chars.push(pad_char);
          }
        }

        for (var i = 0; i < from_length; i++) {
          subs[from_chars[i]] = to_chars[i];
        }
      }

      var new_str = ''
      for (var i = 0, length = self.length; i < length; i++) {
        var ch = self.charAt(i);
        var sub = subs[ch];
        if (inverse) {
          new_str += (sub == null ? global_sub : ch);
        }
        else {
          new_str += (sub != null ? sub : ch);
        }
      }
      return new_str;
    
    };

    def.opal$tr_s = function(from, to) {
      var self = this;

      
      if (from.length == 0) {
        return self;
      }

      var subs = {};
      var from_chars = from.split('');
      var from_length = from_chars.length;
      var to_chars = to.split('');
      var to_length = to_chars.length;

      var inverse = false;
      var global_sub = null;
      if (from_chars[0] === '^') {
        inverse = true;
        from_chars.shift();
        global_sub = to_chars[to_length - 1]
        from_length -= 1;
      }

      var from_chars_expanded = [];
      var last_from = null;
      var in_range = false;
      for (var i = 0; i < from_length; i++) {
        var ch = from_chars[i];
        if (last_from == null) {
          last_from = ch;
          from_chars_expanded.push(ch);
        }
        else if (ch === '-') {
          if (last_from === '-') {
            from_chars_expanded.push('-');
            from_chars_expanded.push('-');
          }
          else if (i == from_length - 1) {
            from_chars_expanded.push('-');
          }
          else {
            in_range = true;
          }
        }
        else if (in_range) {
          var start = last_from.charCodeAt(0) + 1;
          var end = ch.charCodeAt(0);
          for (var c = start; c < end; c++) {
            from_chars_expanded.push(String.fromCharCode(c));
          }
          from_chars_expanded.push(ch);
          in_range = null;
          last_from = null;
        }
        else {
          from_chars_expanded.push(ch);
        }
      }

      from_chars = from_chars_expanded;
      from_length = from_chars.length;

      if (inverse) {
        for (var i = 0; i < from_length; i++) {
          subs[from_chars[i]] = true;
        }
      }
      else {
        if (to_length > 0) {
          var to_chars_expanded = [];
          var last_to = null;
          var in_range = false;
          for (var i = 0; i < to_length; i++) {
            var ch = to_chars[i];
            if (last_from == null) {
              last_from = ch;
              to_chars_expanded.push(ch);
            }
            else if (ch === '-') {
              if (last_to === '-') {
                to_chars_expanded.push('-');
                to_chars_expanded.push('-');
              }
              else if (i == to_length - 1) {
                to_chars_expanded.push('-');
              }
              else {
                in_range = true;
              }
            }
            else if (in_range) {
              var start = last_from.charCodeAt(0) + 1;
              var end = ch.charCodeAt(0);
              for (var c = start; c < end; c++) {
                to_chars_expanded.push(String.fromCharCode(c));
              }
              to_chars_expanded.push(ch);
              in_range = null;
              last_from = null;
            }
            else {
              to_chars_expanded.push(ch);
            }
          }

          to_chars = to_chars_expanded;
          to_length = to_chars.length;
        }

        var length_diff = from_length - to_length;
        if (length_diff > 0) {
          var pad_char = (to_length > 0 ? to_chars[to_length - 1] : '');
          for (var i = 0; i < length_diff; i++) {
            to_chars.push(pad_char);
          }
        }

        for (var i = 0; i < from_length; i++) {
          subs[from_chars[i]] = to_chars[i];
        }
      }
      var new_str = ''
      var last_substitute = null
      for (var i = 0, length = self.length; i < length; i++) {
        var ch = self.charAt(i);
        var sub = subs[ch]
        if (inverse) {
          if (sub == null) {
            if (last_substitute == null) {
              new_str += global_sub;
              last_substitute = true;
            }
          }
          else {
            new_str += ch;
            last_substitute = null;
          }
        }
        else {
          if (sub != null) {
            if (last_substitute == null || last_substitute !== sub) {
              new_str += sub;
              last_substitute = sub;
            }
          }
          else {
            new_str += ch;
            last_substitute = null;
          }
        }
      }
      return new_str;
    
    };

    def.opal$upcase = function() {
      var self = this;

      return self.toUpperCase();
    };

    def.opal$freeze = function() {
      var self = this;

      return self;
    };

    return (def['opal$frozen?'] = function() {
      var self = this;

      return true;
    }, nil) && 'frozen?';
  })(self, null);
  return opal$opal.cdecl(opal$scope, 'Symbol', opal$scope.String);
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass;

  (function(opal$base, opal$super) {
    function opal$String(){};
    var self = opal$String = opal$klass(opal$base, opal$super, 'String', opal$String);

    var def = self._proto, opal$scope = self._scope;

    return (opal$opal.defs(self, 'opal$inherited', function(klass) {
      var self = this, replace = nil;

      replace = opal$scope.Class.opal$new((opal$scope.String)._scope.Wrapper);
      
      klass._proto        = replace._proto;
      klass._proto._klass = klass;
      klass._alloc        = replace._alloc;
      klass.__parent      = (opal$scope.String)._scope.Wrapper;

      klass.opal$allocate = replace.opal$allocate;
      klass.opal$new      = replace.opal$new;
    
    }), nil) && 'inherited'
  })(self, null);
  return (function(opal$base, opal$super) {
    function opal$Wrapper(){};
    var self = opal$Wrapper = opal$klass(opal$base, opal$super, 'Wrapper', opal$Wrapper);

    var def = self._proto, opal$scope = self._scope, TMP_1, TMP_2, TMP_3, TMP_4;

    def.literal = nil;
    opal$opal.defs(self, 'opal$allocate', TMP_1 = function(string) {
      var self = this, opal$iter = TMP_1._p, opal$yield = opal$iter || nil, obj = nil;

      if (string == null) {
        string = ""
      }
      TMP_1._p = null;
      obj = opal$opal.find_super_dispatcher(self, 'allocate', TMP_1, null, opal$Wrapper).apply(self, []);
      obj.literal = string;
      return obj;
    });

    opal$opal.defs(self, 'opal$new', TMP_2 = function(args) {
      var opal$a, opal$b, self = this, opal$iter = TMP_2._p, block = opal$iter || nil, obj = nil;

      args = opal$slice.call(arguments, 0);
      TMP_2._p = null;
      obj = self.opal$allocate();
      (opal$a = (opal$b = obj).opal$initialize, opal$a._p = block.opal$to_proc(), opal$a).apply(opal$b, [].concat(args));
      return obj;
    });

    opal$opal.defs(self, 'opal$[]', function(objects) {
      var self = this;

      objects = opal$slice.call(arguments, 0);
      return self.opal$allocate(objects);
    });

    def.opal$initialize = function(string) {
      var self = this;

      if (string == null) {
        string = ""
      }
      return self.literal = string;
    };

    def.opal$method_missing = TMP_3 = function(args) {
      var opal$a, opal$b, self = this, opal$iter = TMP_3._p, block = opal$iter || nil, result = nil;

      args = opal$slice.call(arguments, 0);
      TMP_3._p = null;
      result = (opal$a = (opal$b = self.literal).opal$__send__, opal$a._p = block.opal$to_proc(), opal$a).apply(opal$b, [].concat(args));
      if (((opal$a = result._isString != null) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        if (((opal$a = result == self.literal) !== nil && (!opal$a._isBoolean || opal$a == true))) {
          return self
          } else {
          return self.opal$class().opal$allocate(result)
        }
        } else {
        return result
      };
    };

    def.opal$initialize_copy = function(other) {
      var self = this;

      return self.literal = (other.literal).opal$clone();
    };

    def['opal$respond_to?'] = TMP_4 = function(name) {var opal$zuper = opal$slice.call(arguments, 0);
      var opal$a, self = this, opal$iter = TMP_4._p, opal$yield = opal$iter || nil;

      TMP_4._p = null;
      return (((opal$a = opal$opal.find_super_dispatcher(self, 'respond_to?', TMP_4, opal$iter).apply(self, opal$zuper)) !== false && opal$a !== nil) ? opal$a : self.literal['opal$respond_to?'](name));
    };

    def['opal$=='] = function(other) {
      var self = this;

      return self.literal['opal$=='](other);
    };

    opal$opal.defn(self, 'opal$eql?', def['opal$==']);

    opal$opal.defn(self, 'opal$===', def['opal$==']);

    def.opal$to_s = function() {
      var self = this;

      return self.literal;
    };

    def.opal$to_str = function() {
      var self = this;

      return self;
    };

    return (def.opal$inspect = function() {
      var self = this;

      return self.literal.opal$inspect();
    }, nil) && 'inspect';
  })(opal$scope.String, null);
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass, opal$gvars = opal$opal.gvars;

  return (function(opal$base, opal$super) {
    function opal$MatchData(){};
    var self = opal$MatchData = opal$klass(opal$base, opal$super, 'MatchData', opal$MatchData);

    var def = self._proto, opal$scope = self._scope, TMP_1;

    def.string = def.matches = def.begin = nil;
    self.opal$attr_reader("post_match", "pre_match", "regexp", "string");

    opal$opal.defs(self, 'opal$new', TMP_1 = function(regexp, match_groups) {
      var self = this, opal$iter = TMP_1._p, opal$yield = opal$iter || nil, data = nil;

      TMP_1._p = null;
      data = opal$opal.find_super_dispatcher(self, 'new', TMP_1, null, opal$MatchData).apply(self, [regexp, match_groups]);
      opal$gvars["`"] = data.opal$pre_match();
      opal$gvars["'"] = data.opal$post_match();
      opal$gvars["~"] = data;
      return data;
    });

    def.opal$initialize = function(regexp, match_groups) {
      var self = this;

      self.regexp = regexp;
      self.begin = match_groups.index;
      self.string = match_groups.input;
      self.pre_match = self.string.substr(0, regexp.lastIndex - match_groups[0].length);
      self.post_match = self.string.substr(regexp.lastIndex);
      self.matches = [];
      
      for (var i = 0, length = match_groups.length; i < length; i++) {
        var group = match_groups[i];

        if (group == null) {
          self.matches.push(nil);
        }
        else {
          self.matches.push(group);
        }
      }
    
    };

    def['opal$[]'] = function(args) {
      var opal$a, self = this;

      args = opal$slice.call(arguments, 0);
      return (opal$a = self.matches)['opal$[]'].apply(opal$a, [].concat(args));
    };

    def['opal$=='] = function(other) {
      var opal$a, opal$b, opal$c, opal$d, self = this;

      if (((opal$a = opal$scope.MatchData['opal$==='](other)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        return false
      };
      return (opal$a = (opal$b = (opal$c = (opal$d = self.string == other.string, opal$d !== false && opal$d !== nil ?self.regexp == other.regexp : opal$d), opal$c !== false && opal$c !== nil ?self.pre_match == other.pre_match : opal$c), opal$b !== false && opal$b !== nil ?self.post_match == other.post_match : opal$b), opal$a !== false && opal$a !== nil ?self.begin == other.begin : opal$a);
    };

    def.opal$begin = function(pos) {
      var opal$a, opal$b, self = this;

      if (((opal$a = (opal$b = pos['opal$=='](0)['opal$!'](), opal$b !== false && opal$b !== nil ?pos['opal$=='](1)['opal$!']() : opal$b)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.ArgumentError, "MatchData#begin only supports 0th element")};
      return self.begin;
    };

    def.opal$captures = function() {
      var self = this;

      return self.matches.slice(1);
    };

    def.opal$inspect = function() {
      var self = this;

      
      var str = "#<MatchData " + (self.matches[0]).opal$inspect();

      for (var i = 1, length = self.matches.length; i < length; i++) {
        str += " " + i + ":" + (self.matches[i]).opal$inspect();
      }

      return str + ">";
    ;
    };

    def.opal$length = function() {
      var self = this;

      return self.matches.length;
    };

    opal$opal.defn(self, 'opal$size', def.opal$length);

    def.opal$to_a = function() {
      var self = this;

      return self.matches;
    };

    def.opal$to_s = function() {
      var self = this;

      return self.matches[0];
    };

    return (def.opal$values_at = function(indexes) {
      var self = this;

      indexes = opal$slice.call(arguments, 0);
      
      var values       = [],
          match_length = self.matches.length;

      for (var i = 0, length = indexes.length; i < length; i++) {
        var pos = indexes[i];

        if (pos >= 0) {
          values.push(self.matches[pos]);
        }
        else {
          pos += match_length;

          if (pos > 0) {
            values.push(self.matches[pos]);
          }
          else {
            values.push(nil);
          }
        }
      }

      return values;
    ;
    }, nil) && 'values_at';
  })(self, null)
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass;

  ;
  (function(opal$base, opal$super) {
    function opal$Numeric(){};
    var self = opal$Numeric = opal$klass(opal$base, opal$super, 'Numeric', opal$Numeric);

    var def = self._proto, opal$scope = self._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6;

    self.opal$include(opal$scope.Comparable);

    def._isNumber = true;

    def.opal$coerce = function(other, type) {
      var self = this, opal$case = nil;

      if (type == null) {
        type = "operation"
      }
      try {
      
      if (other._isNumber) {
        return [self, other];
      }
      else {
        return other.opal$coerce(self);
      }
    
      } catch (opal$err) {if (true) {
        return (function() {opal$case = type;if ("operation"['opal$==='](opal$case)) {return self.opal$raise(opal$scope.TypeError, "" + (other.opal$class()) + " can't be coerce into Numeric")}else if ("comparison"['opal$==='](opal$case)) {return self.opal$raise(opal$scope.ArgumentError, "comparison of " + (self.opal$class()) + " with " + (other.opal$class()) + " failed")}else { return nil }})()
        }else { throw opal$err; }
      };
    };

    def.opal$send_coerced = function(method, other) {
      var opal$a, self = this, type = nil, opal$case = nil, a = nil, b = nil;

      type = (function() {opal$case = method;if ("+"['opal$==='](opal$case) || "-"['opal$==='](opal$case) || "*"['opal$==='](opal$case) || "/"['opal$==='](opal$case) || "%"['opal$==='](opal$case) || "&"['opal$==='](opal$case) || "|"['opal$==='](opal$case) || "^"['opal$==='](opal$case) || "**"['opal$==='](opal$case)) {return "operation"}else if (">"['opal$==='](opal$case) || ">="['opal$==='](opal$case) || "<"['opal$==='](opal$case) || "<="['opal$==='](opal$case) || "<=>"['opal$==='](opal$case)) {return "comparison"}else { return nil }})();
      opal$a = opal$opal.to_ary(self.opal$coerce(other, type)), a = (opal$a[0] == null ? nil : opal$a[0]), b = (opal$a[1] == null ? nil : opal$a[1]);
      return a.opal$__send__(method, b);
    };

    def['opal$+'] = function(other) {
      var self = this;

      
      if (other._isNumber) {
        return self + other;
      }
      else {
        return self.opal$send_coerced("+", other);
      }
    
    };

    def['opal$-'] = function(other) {
      var self = this;

      
      if (other._isNumber) {
        return self - other;
      }
      else {
        return self.opal$send_coerced("-", other);
      }
    
    };

    def['opal$*'] = function(other) {
      var self = this;

      
      if (other._isNumber) {
        return self * other;
      }
      else {
        return self.opal$send_coerced("*", other);
      }
    
    };

    def['opal$/'] = function(other) {
      var self = this;

      
      if (other._isNumber) {
        return self / other;
      }
      else {
        return self.opal$send_coerced("/", other);
      }
    
    };

    def['opal$%'] = function(other) {
      var self = this;

      
      if (other._isNumber) {
        if (other < 0 || self < 0) {
          return (self % other + other) % other;
        }
        else {
          return self % other;
        }
      }
      else {
        return self.opal$send_coerced("%", other);
      }
    
    };

    def['opal$&'] = function(other) {
      var self = this;

      
      if (other._isNumber) {
        return self & other;
      }
      else {
        return self.opal$send_coerced("&", other);
      }
    
    };

    def['opal$|'] = function(other) {
      var self = this;

      
      if (other._isNumber) {
        return self | other;
      }
      else {
        return self.opal$send_coerced("|", other);
      }
    
    };

    def['opal$^'] = function(other) {
      var self = this;

      
      if (other._isNumber) {
        return self ^ other;
      }
      else {
        return self.opal$send_coerced("^", other);
      }
    
    };

    def['opal$<'] = function(other) {
      var self = this;

      
      if (other._isNumber) {
        return self < other;
      }
      else {
        return self.opal$send_coerced("<", other);
      }
    
    };

    def['opal$<='] = function(other) {
      var self = this;

      
      if (other._isNumber) {
        return self <= other;
      }
      else {
        return self.opal$send_coerced("<=", other);
      }
    
    };

    def['opal$>'] = function(other) {
      var self = this;

      
      if (other._isNumber) {
        return self > other;
      }
      else {
        return self.opal$send_coerced(">", other);
      }
    
    };

    def['opal$>='] = function(other) {
      var self = this;

      
      if (other._isNumber) {
        return self >= other;
      }
      else {
        return self.opal$send_coerced(">=", other);
      }
    
    };

    def['opal$<=>'] = function(other) {
      var self = this;

      try {
      
      if (other._isNumber) {
        return self > other ? 1 : (self < other ? -1 : 0);
      }
      else {
        return self.opal$send_coerced("<=>", other);
      }
    
      } catch (opal$err) {if (opal$opal.opal$rescue(opal$err, [opal$scope.ArgumentError])) {
        return nil
        }else { throw opal$err; }
      };
    };

    def['opal$<<'] = function(count) {
      var self = this;

      return self << count.opal$to_int();
    };

    def['opal$>>'] = function(count) {
      var self = this;

      return self >> count.opal$to_int();
    };

    def['opal$[]'] = function(bit) {
      var self = this, min = nil, max = nil;

      bit = opal$scope.Opal['opal$coerce_to!'](bit, opal$scope.Integer, "to_int");
      min = ((2)['opal$**'](30))['opal$-@']();
      max = ((2)['opal$**'](30))['opal$-'](1);
      return (bit < min || bit > max) ? 0 : (self >> bit) % 2;
    };

    def['opal$+@'] = function() {
      var self = this;

      return +self;
    };

    def['opal$-@'] = function() {
      var self = this;

      return -self;
    };

    def['opal$~'] = function() {
      var self = this;

      return ~self;
    };

    def['opal$**'] = function(other) {
      var self = this;

      
      if (other._isNumber) {
        return Math.pow(self, other);
      }
      else {
        return self.opal$send_coerced("**", other);
      }
    
    };

    def['opal$=='] = function(other) {
      var self = this;

      
      if (other._isNumber) {
        return self == Number(other);
      }
      else if (other['opal$respond_to?']("==")) {
        return other['opal$=='](self);
      }
      else {
        return false;
      }
    ;
    };

    def.opal$abs = function() {
      var self = this;

      return Math.abs(self);
    };

    def.opal$ceil = function() {
      var self = this;

      return Math.ceil(self);
    };

    def.opal$chr = function() {
      var self = this;

      return String.fromCharCode(self);
    };

    def.opal$conj = function() {
      var self = this;

      return self;
    };

    opal$opal.defn(self, 'opal$conjugate', def.opal$conj);

    def.opal$downto = TMP_1 = function(finish) {
      var self = this, opal$iter = TMP_1._p, block = opal$iter || nil;

      TMP_1._p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("downto", finish)
      };
      
      for (var i = self; i >= finish; i--) {
        if (block(i) === opal$breaker) {
          return opal$breaker.opal$v;
        }
      }
    
      return self;
    };

    opal$opal.defn(self, 'opal$eql?', def['opal$==']);

    opal$opal.defn(self, 'opal$equal?', def['opal$==']);

    def['opal$even?'] = function() {
      var self = this;

      return self % 2 === 0;
    };

    def.opal$floor = function() {
      var self = this;

      return Math.floor(self);
    };

    def.opal$gcd = function(other) {
      var opal$a, self = this;

      if (((opal$a = opal$scope.Integer['opal$==='](other)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.TypeError, "not an integer")
      };
      
      var min = Math.abs(self),
          max = Math.abs(other);

      while (min > 0) {
        var tmp = min;

        min = max % min;
        max = tmp;
      }

      return max;
    
    };

    def.opal$gcdlcm = function(other) {
      var self = this;

      return [self.opal$gcd(), self.opal$lcm()];
    };

    def.opal$hash = function() {
      var self = this;

      return self.toString();
    };

    def['opal$integer?'] = function() {
      var self = this;

      return self % 1 === 0;
    };

    def['opal$is_a?'] = TMP_2 = function(klass) {var opal$zuper = opal$slice.call(arguments, 0);
      var opal$a, opal$b, self = this, opal$iter = TMP_2._p, opal$yield = opal$iter || nil;

      TMP_2._p = null;
      if (((opal$a = ((opal$b = klass['opal$=='](opal$scope.Fixnum)) ? opal$scope.Integer['opal$==='](self) : opal$b)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return true};
      if (((opal$a = ((opal$b = klass['opal$=='](opal$scope.Integer)) ? opal$scope.Integer['opal$==='](self) : opal$b)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return true};
      if (((opal$a = ((opal$b = klass['opal$=='](opal$scope.Float)) ? opal$scope.Float['opal$==='](self) : opal$b)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return true};
      return opal$opal.find_super_dispatcher(self, 'is_a?', TMP_2, opal$iter).apply(self, opal$zuper);
    };

    opal$opal.defn(self, 'opal$kind_of?', def['opal$is_a?']);

    def['opal$instance_of?'] = TMP_3 = function(klass) {var opal$zuper = opal$slice.call(arguments, 0);
      var opal$a, opal$b, self = this, opal$iter = TMP_3._p, opal$yield = opal$iter || nil;

      TMP_3._p = null;
      if (((opal$a = ((opal$b = klass['opal$=='](opal$scope.Fixnum)) ? opal$scope.Integer['opal$==='](self) : opal$b)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return true};
      if (((opal$a = ((opal$b = klass['opal$=='](opal$scope.Integer)) ? opal$scope.Integer['opal$==='](self) : opal$b)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return true};
      if (((opal$a = ((opal$b = klass['opal$=='](opal$scope.Float)) ? opal$scope.Float['opal$==='](self) : opal$b)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return true};
      return opal$opal.find_super_dispatcher(self, 'instance_of?', TMP_3, opal$iter).apply(self, opal$zuper);
    };

    def.opal$lcm = function(other) {
      var opal$a, self = this;

      if (((opal$a = opal$scope.Integer['opal$==='](other)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.TypeError, "not an integer")
      };
      
      if (self == 0 || other == 0) {
        return 0;
      }
      else {
        return Math.abs(self * other / self.opal$gcd(other));
      }
    
    };

    opal$opal.defn(self, 'opal$magnitude', def.opal$abs);

    opal$opal.defn(self, 'opal$modulo', def['opal$%']);

    def.opal$next = function() {
      var self = this;

      return self + 1;
    };

    def['opal$nonzero?'] = function() {
      var self = this;

      return self == 0 ? nil : self;
    };

    def['opal$odd?'] = function() {
      var self = this;

      return self % 2 !== 0;
    };

    def.opal$ord = function() {
      var self = this;

      return self;
    };

    def.opal$pred = function() {
      var self = this;

      return self - 1;
    };

    def.opal$round = function() {
      var self = this;

      return Math.round(self);
    };

    def.opal$step = TMP_4 = function(limit, step) {
      var opal$a, self = this, opal$iter = TMP_4._p, block = opal$iter || nil;

      if (step == null) {
        step = 1
      }
      TMP_4._p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("step", limit, step)
      };
      if (((opal$a = step == 0) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.ArgumentError, "step cannot be 0")};
      
      var value = self;

      if (step > 0) {
        while (value <= limit) {
          block(value);
          value += step;
        }
      }
      else {
        while (value >= limit) {
          block(value);
          value += step;
        }
      }
    
      return self;
    };

    opal$opal.defn(self, 'opal$succ', def.opal$next);

    def.opal$times = TMP_5 = function() {
      var self = this, opal$iter = TMP_5._p, block = opal$iter || nil;

      TMP_5._p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("times")
      };
      
      for (var i = 0; i < self; i++) {
        if (block(i) === opal$breaker) {
          return opal$breaker.opal$v;
        }
      }
    
      return self;
    };

    def.opal$to_f = function() {
      var self = this;

      return self;
    };

    def.opal$to_i = function() {
      var self = this;

      return parseInt(self);
    };

    opal$opal.defn(self, 'opal$to_int', def.opal$to_i);

    def.opal$to_s = function(base) {
      var opal$a, opal$b, self = this;

      if (base == null) {
        base = 10
      }
      if (((opal$a = (((opal$b = base['opal$<'](2)) !== false && opal$b !== nil) ? opal$b : base['opal$>'](36))) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.ArgumentError, "base must be between 2 and 36")};
      return self.toString(base);
    };

    opal$opal.defn(self, 'opal$inspect', def.opal$to_s);

    def.opal$divmod = function(rhs) {
      var self = this, q = nil, r = nil;

      q = (self['opal$/'](rhs)).opal$floor();
      r = self['opal$%'](rhs);
      return [q, r];
    };

    def.opal$upto = TMP_6 = function(finish) {
      var self = this, opal$iter = TMP_6._p, block = opal$iter || nil;

      TMP_6._p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.opal$enum_for("upto", finish)
      };
      
      for (var i = self; i <= finish; i++) {
        if (block(i) === opal$breaker) {
          return opal$breaker.opal$v;
        }
      }
    
      return self;
    };

    def['opal$zero?'] = function() {
      var self = this;

      return self == 0;
    };

    def.opal$size = function() {
      var self = this;

      return 4;
    };

    def['opal$nan?'] = function() {
      var self = this;

      return isNaN(self);
    };

    def['opal$finite?'] = function() {
      var self = this;

      return self != Infinity && self != -Infinity;
    };

    def['opal$infinite?'] = function() {
      var self = this;

      
      if (self == Infinity) {
        return +1;
      }
      else if (self == -Infinity) {
        return -1;
      }
      else {
        return nil;
      }
    
    };

    def['opal$positive?'] = function() {
      var self = this;

      return 1 / self > 0;
    };

    return (def['opal$negative?'] = function() {
      var self = this;

      return 1 / self < 0;
    }, nil) && 'negative?';
  })(self, null);
  opal$opal.cdecl(opal$scope, 'Fixnum', opal$scope.Numeric);
  (function(opal$base, opal$super) {
    function opal$Integer(){};
    var self = opal$Integer = opal$klass(opal$base, opal$super, 'Integer', opal$Integer);

    var def = self._proto, opal$scope = self._scope;

    return (opal$opal.defs(self, 'opal$===', function(other) {
      var self = this;

      
      if (!other._isNumber) {
        return false;
      }

      return (other % 1) === 0;
    
    }), nil) && '==='
  })(self, opal$scope.Numeric);
  return (function(opal$base, opal$super) {
    function opal$Float(){};
    var self = opal$Float = opal$klass(opal$base, opal$super, 'Float', opal$Float);

    var def = self._proto, opal$scope = self._scope, opal$a;

    opal$opal.defs(self, 'opal$===', function(other) {
      var self = this;

      return !!other._isNumber;
    });

    opal$opal.cdecl(opal$scope, 'INFINITY', Infinity);

    opal$opal.cdecl(opal$scope, 'NAN', NaN);

    if (((opal$a = (typeof(Number.EPSILON) !== "undefined")) !== nil && (!opal$a._isBoolean || opal$a == true))) {
      return opal$opal.cdecl(opal$scope, 'EPSILON', Number.EPSILON)
      } else {
      return opal$opal.cdecl(opal$scope, 'EPSILON', 2.2204460492503130808472633361816E-16)
    };
  })(self, opal$scope.Numeric);
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass;

  return (function(opal$base, opal$super) {
    function opal$Complex(){};
    var self = opal$Complex = opal$klass(opal$base, opal$super, 'Complex', opal$Complex);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.Numeric)
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass;

  return (function(opal$base, opal$super) {
    function opal$Rational(){};
    var self = opal$Rational = opal$klass(opal$base, opal$super, 'Rational', opal$Rational);

    var def = self._proto, opal$scope = self._scope;

    return nil;
  })(self, opal$scope.Numeric)
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass;

  return (function(opal$base, opal$super) {
    function opal$Proc(){};
    var self = opal$Proc = opal$klass(opal$base, opal$super, 'Proc', opal$Proc);

    var def = self._proto, opal$scope = self._scope, TMP_1, TMP_2;

    def._isProc = true;

    def.is_lambda = false;

    opal$opal.defs(self, 'opal$new', TMP_1 = function() {
      var self = this, opal$iter = TMP_1._p, block = opal$iter || nil;

      TMP_1._p = null;
      if (block !== false && block !== nil) {
        } else {
        self.opal$raise(opal$scope.ArgumentError, "tried to create a Proc object without a block")
      };
      return block;
    });

    def.opal$call = TMP_2 = function(args) {
      var self = this, opal$iter = TMP_2._p, block = opal$iter || nil;

      args = opal$slice.call(arguments, 0);
      TMP_2._p = null;
      
      if (block !== nil) {
        self._p = block;
      }

      var result;

      if (self.is_lambda) {
        result = self.apply(null, args);
      }
      else {
        result = Opal.opal$yieldX(self, args);
      }

      if (result === opal$breaker) {
        return opal$breaker.opal$v;
      }

      return result;
    
    };

    opal$opal.defn(self, 'opal$[]', def.opal$call);

    def.opal$to_proc = function() {
      var self = this;

      return self;
    };

    def['opal$lambda?'] = function() {
      var self = this;

      return !!self.is_lambda;
    };

    return (def.opal$arity = function() {
      var self = this;

      return self.length;
    }, nil) && 'arity';
  })(self, null)
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass;

  (function(opal$base, opal$super) {
    function opal$Method(){};
    var self = opal$Method = opal$klass(opal$base, opal$super, 'Method', opal$Method);

    var def = self._proto, opal$scope = self._scope, TMP_1;

    def.method = def.receiver = def.owner = def.name = def.obj = nil;
    self.opal$attr_reader("owner", "receiver", "name");

    def.opal$initialize = function(receiver, method, name) {
      var self = this;

      self.receiver = receiver;
      self.owner = receiver.opal$class();
      self.name = name;
      return self.method = method;
    };

    def.opal$arity = function() {
      var self = this;

      return self.method.opal$arity();
    };

    def.opal$call = TMP_1 = function(args) {
      var self = this, opal$iter = TMP_1._p, block = opal$iter || nil;

      args = opal$slice.call(arguments, 0);
      TMP_1._p = null;
      
      self.method._p = block;

      return self.method.apply(self.receiver, args);
    ;
    };

    opal$opal.defn(self, 'opal$[]', def.opal$call);

    def.opal$unbind = function() {
      var self = this;

      return opal$scope.UnboundMethod.opal$new(self.owner, self.method, self.name);
    };

    def.opal$to_proc = function() {
      var self = this;

      return self.method;
    };

    return (def.opal$inspect = function() {
      var self = this;

      return "#<Method: " + (self.obj.opal$class().opal$name()) + "#" + (self.name) + "}>";
    }, nil) && 'inspect';
  })(self, null);
  return (function(opal$base, opal$super) {
    function opal$UnboundMethod(){};
    var self = opal$UnboundMethod = opal$klass(opal$base, opal$super, 'UnboundMethod', opal$UnboundMethod);

    var def = self._proto, opal$scope = self._scope;

    def.method = def.name = def.owner = nil;
    self.opal$attr_reader("owner", "name");

    def.opal$initialize = function(owner, method, name) {
      var self = this;

      self.owner = owner;
      self.method = method;
      return self.name = name;
    };

    def.opal$arity = function() {
      var self = this;

      return self.method.opal$arity();
    };

    def.opal$bind = function(object) {
      var self = this;

      return opal$scope.Method.opal$new(object, self.method, self.name);
    };

    return (def.opal$inspect = function() {
      var self = this;

      return "#<UnboundMethod: " + (self.owner.opal$name()) + "#" + (self.name) + ">";
    }, nil) && 'inspect';
  })(self, null);
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass;

  ;
  return (function(opal$base, opal$super) {
    function opal$Range(){};
    var self = opal$Range = opal$klass(opal$base, opal$super, 'Range', opal$Range);

    var def = self._proto, opal$scope = self._scope, TMP_1, TMP_2, TMP_3;

    def.begin = def.exclude = def.end = nil;
    self.opal$include(opal$scope.Enumerable);

    def._isRange = true;

    self.opal$attr_reader("begin", "end");

    def.opal$initialize = function(first, last, exclude) {
      var self = this;

      if (exclude == null) {
        exclude = false
      }
      self.begin = first;
      self.end = last;
      return self.exclude = exclude;
    };

    def['opal$=='] = function(other) {
      var self = this;

      
      if (!other._isRange) {
        return false;
      }

      return self.exclude === other.exclude &&
             self.begin   ==  other.begin &&
             self.end     ==  other.end;
    
    };

    def['opal$==='] = function(value) {
      var opal$a, opal$b, self = this;

      return ((opal$a = self.begin['opal$<='](value)) ? ((function() {if (((opal$b = self.exclude) !== nil && (!opal$b._isBoolean || opal$b == true))) {
        return value['opal$<'](self.end)
        } else {
        return value['opal$<='](self.end)
      }; return nil; })()) : opal$a);
    };

    opal$opal.defn(self, 'opal$cover?', def['opal$===']);

    def.opal$each = TMP_1 = function() {
      var opal$a, opal$b, self = this, opal$iter = TMP_1._p, block = opal$iter || nil, current = nil, last = nil;

      TMP_1._p = null;
      if ((block !== nil)) {
        } else {
        return self.opal$enum_for("each")
      };
      current = self.begin;
      last = self.end;
      while (current['opal$<'](last)) {
      if (opal$opal.opal$yield1(block, current) === opal$breaker) return opal$breaker.opal$v;
      current = current.opal$succ();};
      if (((opal$a = (opal$b = self.exclude['opal$!'](), opal$b !== false && opal$b !== nil ?current['opal$=='](last) : opal$b)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        if (opal$opal.opal$yield1(block, current) === opal$breaker) return opal$breaker.opal$v};
      return self;
    };

    def['opal$eql?'] = function(other) {
      var opal$a, opal$b, self = this;

      if (((opal$a = opal$scope.Range['opal$==='](other)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        return false
      };
      return (opal$a = (opal$b = self.exclude['opal$==='](other['opal$exclude_end?']()), opal$b !== false && opal$b !== nil ?self.begin['opal$eql?'](other.opal$begin()) : opal$b), opal$a !== false && opal$a !== nil ?self.end['opal$eql?'](other.opal$end()) : opal$a);
    };

    def['opal$exclude_end?'] = function() {
      var self = this;

      return self.exclude;
    };

    opal$opal.defn(self, 'opal$first', def.opal$begin);

    opal$opal.defn(self, 'opal$include?', def['opal$cover?']);

    opal$opal.defn(self, 'opal$last', def.opal$end);

    def.opal$max = TMP_2 = function() {var opal$zuper = opal$slice.call(arguments, 0);
      var self = this, opal$iter = TMP_2._p, opal$yield = opal$iter || nil;

      TMP_2._p = null;
      if ((opal$yield !== nil)) {
        return opal$opal.find_super_dispatcher(self, 'max', TMP_2, opal$iter).apply(self, opal$zuper)
        } else {
        return self.exclude ? self.end - 1 : self.end;
      };
    };

    opal$opal.defn(self, 'opal$member?', def['opal$cover?']);

    def.opal$min = TMP_3 = function() {var opal$zuper = opal$slice.call(arguments, 0);
      var self = this, opal$iter = TMP_3._p, opal$yield = opal$iter || nil;

      TMP_3._p = null;
      if ((opal$yield !== nil)) {
        return opal$opal.find_super_dispatcher(self, 'min', TMP_3, opal$iter).apply(self, opal$zuper)
        } else {
        return self.begin
      };
    };

    opal$opal.defn(self, 'opal$member?', def['opal$include?']);

    def.opal$size = function() {
      var opal$a, opal$b, self = this, _begin = nil, _end = nil, infinity = nil;

      _begin = self.begin;
      _end = self.end;
      if (((opal$a = self.exclude) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        _end = _end['opal$-'](1)};
      if (((opal$a = (opal$b = opal$scope.Numeric['opal$==='](_begin), opal$b !== false && opal$b !== nil ?opal$scope.Numeric['opal$==='](_end) : opal$b)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        return nil
      };
      if (_end['opal$<'](_begin)) {
        return 0};
      infinity = (opal$scope.Float)._scope.INFINITY;
      if (((opal$a = (((opal$b = infinity['opal$=='](_begin.opal$abs())) !== false && opal$b !== nil) ? opal$b : _end.opal$abs()['opal$=='](infinity))) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return infinity};
      return ((Math.abs(_end - _begin) + 1)).opal$to_i();
    };

    def.opal$step = function(n) {
      var self = this;

      if (n == null) {
        n = 1
      }
      return self.opal$raise(opal$scope.NotImplementedError);
    };

    def.opal$to_s = function() {
      var self = this;

      return self.begin.opal$inspect() + (self.exclude ? '...' : '..') + self.end.opal$inspect();
    };

    return opal$opal.defn(self, 'opal$inspect', def.opal$to_s);
  })(self, null);
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass;

  ;
  return (function(opal$base, opal$super) {
    function opal$Time(){};
    var self = opal$Time = opal$klass(opal$base, opal$super, 'Time', opal$Time);

    var def = self._proto, opal$scope = self._scope;

    self.opal$include(opal$scope.Comparable);

    
    var days_of_week = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        short_days   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        short_months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        long_months  = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  ;

    opal$opal.defs(self, 'opal$at', function(seconds, frac) {
      var self = this;

      if (frac == null) {
        frac = 0
      }
      return new Date(seconds * 1000 + frac);
    });

    opal$opal.defs(self, 'opal$new', function(year, month, day, hour, minute, second, utc_offset) {
      var self = this;

      
      switch (arguments.length) {
        case 1:
          return new Date(year, 0);

        case 2:
          return new Date(year, month - 1);

        case 3:
          return new Date(year, month - 1, day);

        case 4:
          return new Date(year, month - 1, day, hour);

        case 5:
          return new Date(year, month - 1, day, hour, minute);

        case 6:
          return new Date(year, month - 1, day, hour, minute, second);

        case 7:
          return new Date(year, month - 1, day, hour, minute, second);

        default:
          return new Date();
      }
    
    });

    opal$opal.defs(self, 'opal$local', function(year, month, day, hour, minute, second, millisecond) {
      var opal$a, self = this;

      if (month == null) {
        month = nil
      }
      if (day == null) {
        day = nil
      }
      if (hour == null) {
        hour = nil
      }
      if (minute == null) {
        minute = nil
      }
      if (second == null) {
        second = nil
      }
      if (millisecond == null) {
        millisecond = nil
      }
      if (((opal$a = arguments.length === 10) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        
        var args = opal$slice.call(arguments).reverse();

        second = args[9];
        minute = args[8];
        hour   = args[7];
        day    = args[6];
        month  = args[5];
        year   = args[4];
      };
      year = (function() {if (((opal$a = year['opal$kind_of?'](opal$scope.String)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return year.opal$to_i()
        } else {
        return opal$scope.Opal.opal$coerce_to(year, opal$scope.Integer, "to_int")
      }; return nil; })();
      month = (function() {if (((opal$a = month['opal$kind_of?'](opal$scope.String)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return month.opal$to_i()
        } else {
        return opal$scope.Opal.opal$coerce_to((((opal$a = month) !== false && opal$a !== nil) ? opal$a : 1), opal$scope.Integer, "to_int")
      }; return nil; })();
      if (((opal$a = month['opal$between?'](1, 12)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.ArgumentError, "month out of range: " + (month))
      };
      day = (function() {if (((opal$a = day['opal$kind_of?'](opal$scope.String)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return day.opal$to_i()
        } else {
        return opal$scope.Opal.opal$coerce_to((((opal$a = day) !== false && opal$a !== nil) ? opal$a : 1), opal$scope.Integer, "to_int")
      }; return nil; })();
      if (((opal$a = day['opal$between?'](1, 31)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.ArgumentError, "day out of range: " + (day))
      };
      hour = (function() {if (((opal$a = hour['opal$kind_of?'](opal$scope.String)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return hour.opal$to_i()
        } else {
        return opal$scope.Opal.opal$coerce_to((((opal$a = hour) !== false && opal$a !== nil) ? opal$a : 0), opal$scope.Integer, "to_int")
      }; return nil; })();
      if (((opal$a = hour['opal$between?'](0, 24)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.ArgumentError, "hour out of range: " + (hour))
      };
      minute = (function() {if (((opal$a = minute['opal$kind_of?'](opal$scope.String)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return minute.opal$to_i()
        } else {
        return opal$scope.Opal.opal$coerce_to((((opal$a = minute) !== false && opal$a !== nil) ? opal$a : 0), opal$scope.Integer, "to_int")
      }; return nil; })();
      if (((opal$a = minute['opal$between?'](0, 59)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.ArgumentError, "minute out of range: " + (minute))
      };
      second = (function() {if (((opal$a = second['opal$kind_of?'](opal$scope.String)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return second.opal$to_i()
        } else {
        return opal$scope.Opal.opal$coerce_to((((opal$a = second) !== false && opal$a !== nil) ? opal$a : 0), opal$scope.Integer, "to_int")
      }; return nil; })();
      if (((opal$a = second['opal$between?'](0, 59)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.ArgumentError, "second out of range: " + (second))
      };
      return (opal$a = self).opal$new.apply(opal$a, [].concat([year, month, day, hour, minute, second].opal$compact()));
    });

    opal$opal.defs(self, 'opal$gm', function(year, month, day, hour, minute, second, utc_offset) {
      var opal$a, self = this;

      if (((opal$a = year['opal$nil?']()) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.TypeError, "missing year (got nil)")};
      
      if (month > 12 || day > 31 || hour > 24 || minute > 59 || second > 59) {
        self.opal$raise(opal$scope.ArgumentError);
      }

      var date = new Date(Date.UTC(year, (month || 1) - 1, (day || 1), (hour || 0), (minute || 0), (second || 0)));
      date.tz_offset = 0
      return date;
    ;
    });

    (function(self) {
      var opal$scope = self._scope, def = self._proto;

      self._proto.opal$mktime = self._proto.opal$local;
      return self._proto.opal$utc = self._proto.opal$gm;
    })(self.opal$singleton_class());

    opal$opal.defs(self, 'opal$now', function() {
      var self = this;

      return new Date();
    });

    def['opal$+'] = function(other) {
      var opal$a, self = this;

      if (((opal$a = opal$scope.Time['opal$==='](other)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        self.opal$raise(opal$scope.TypeError, "time + time?")};
      other = opal$scope.Opal.opal$coerce_to(other, opal$scope.Integer, "to_int");
      
      var result = new Date(self.getTime() + (other * 1000));
      result.tz_offset = self.tz_offset;
      return result;
    
    };

    def['opal$-'] = function(other) {
      var opal$a, self = this;

      if (((opal$a = opal$scope.Time['opal$==='](other)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return (self.getTime() - other.getTime()) / 1000;
        } else {
        other = opal$scope.Opal.opal$coerce_to(other, opal$scope.Integer, "to_int");
        
        var result = new Date(self.getTime() - (other * 1000));
        result.tz_offset = self.tz_offset;
        return result;
      
      };
    };

    def['opal$<=>'] = function(other) {
      var self = this;

      return self.opal$to_f()['opal$<=>'](other.opal$to_f());
    };

    def['opal$=='] = function(other) {
      var self = this;

      return self.opal$to_f() === other.opal$to_f();
    };

    def.opal$asctime = function() {
      var self = this;

      return self.opal$strftime("%a %b %e %H:%M:%S %Y");
    };

    opal$opal.defn(self, 'opal$ctime', def.opal$asctime);

    def.opal$day = function() {
      var self = this;

      return self.getDate();
    };

    def.opal$yday = function() {
      var self = this;

      
      // http://javascript.about.com/library/bldayyear.htm
      var onejan = new Date(self.getFullYear(), 0, 1);
      return Math.ceil((self - onejan) / 86400000);
    
    };

    def.opal$isdst = function() {
      var self = this;

      return self.opal$raise(opal$scope.NotImplementedError);
    };

    def['opal$eql?'] = function(other) {
      var opal$a, self = this;

      return (opal$a = other['opal$is_a?'](opal$scope.Time), opal$a !== false && opal$a !== nil ?(self['opal$<=>'](other))['opal$zero?']() : opal$a);
    };

    def['opal$friday?'] = function() {
      var self = this;

      return self.getDay() === 5;
    };

    def.opal$hour = function() {
      var self = this;

      return self.getHours();
    };

    def.opal$inspect = function() {
      var opal$a, self = this;

      if (((opal$a = self['opal$utc?']()) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        return self.opal$strftime("%Y-%m-%d %H:%M:%S UTC")
        } else {
        return self.opal$strftime("%Y-%m-%d %H:%M:%S %z")
      };
    };

    opal$opal.defn(self, 'opal$mday', def.opal$day);

    def.opal$min = function() {
      var self = this;

      return self.getMinutes();
    };

    def.opal$mon = function() {
      var self = this;

      return self.getMonth() + 1;
    };

    def['opal$monday?'] = function() {
      var self = this;

      return self.getDay() === 1;
    };

    opal$opal.defn(self, 'opal$month', def.opal$mon);

    def['opal$saturday?'] = function() {
      var self = this;

      return self.getDay() === 6;
    };

    def.opal$sec = function() {
      var self = this;

      return self.getSeconds();
    };

    def.opal$usec = function() {
      var self = this;

      self.opal$warn("Microseconds are not supported");
      return 0;
    };

    def.opal$zone = function() {
      var self = this;

      
      var string = self.toString(),
          result;

      if (string.indexOf('(') == -1) {
        result = string.match(/[A-Z]{3,4}/)[0];
      }
      else {
        result = string.match(/\([^)]+\)/)[0].match(/[A-Z]/g).join('');
      }

      if (result == "GMT" && /(GMT\W*\d{4})/.test(string)) {
        return RegExp.opal$1;
      }
      else {
        return result;
      }
    
    };

    def.opal$getgm = function() {
      var self = this;

      
      var result = new Date(self.getTime());
      result.tz_offset = 0;
      return result;
    
    };

    def['opal$gmt?'] = function() {
      var self = this;

      return self.tz_offset == 0;
    };

    def.opal$gmt_offset = function() {
      var self = this;

      return -self.getTimezoneOffset() * 60;
    };

    def.opal$strftime = function(format) {
      var self = this;

      
      return format.replace(/%([\-_#^0]*:{0,2})(\d+)?([EO]*)(.)/g, function(full, flags, width, _, conv) {
        var result = "",
            width  = parseInt(width),
            zero   = flags.indexOf('0') !== -1,
            pad    = flags.indexOf('-') === -1,
            blank  = flags.indexOf('_') !== -1,
            upcase = flags.indexOf('^') !== -1,
            invert = flags.indexOf('#') !== -1,
            colons = (flags.match(':') || []).length;

        if (zero && blank) {
          if (flags.indexOf('0') < flags.indexOf('_')) {
            zero = false;
          }
          else {
            blank = false;
          }
        }

        switch (conv) {
          case 'Y':
            result += self.getFullYear();
            break;

          case 'C':
            zero    = !blank;
            result += Match.round(self.getFullYear() / 100);
            break;

          case 'y':
            zero    = !blank;
            result += (self.getFullYear() % 100);
            break;

          case 'm':
            zero    = !blank;
            result += (self.getMonth() + 1);
            break;

          case 'B':
            result += long_months[self.getMonth()];
            break;

          case 'b':
          case 'h':
            blank   = !zero;
            result += short_months[self.getMonth()];
            break;

          case 'd':
            zero    = !blank
            result += self.getDate();
            break;

          case 'e':
            blank   = !zero
            result += self.getDate();
            break;

          case 'j':
            result += self.opal$yday();
            break;

          case 'H':
            zero    = !blank;
            result += self.getHours();
            break;

          case 'k':
            blank   = !zero;
            result += self.getHours();
            break;

          case 'I':
            zero    = !blank;
            result += (self.getHours() % 12 || 12);
            break;

          case 'l':
            blank   = !zero;
            result += (self.getHours() % 12 || 12);
            break;

          case 'P':
            result += (self.getHours() >= 12 ? "pm" : "am");
            break;

          case 'p':
            result += (self.getHours() >= 12 ? "PM" : "AM");
            break;

          case 'M':
            zero    = !blank;
            result += self.getMinutes();
            break;

          case 'S':
            zero    = !blank;
            result += self.getSeconds();
            break;

          case 'L':
            zero    = !blank;
            width   = isNaN(width) ? 3 : width;
            result += self.getMilliseconds();
            break;

          case 'N':
            width   = isNaN(width) ? 9 : width;
            result += (self.getMilliseconds().toString()).opal$rjust(3, "0");
            result  = (result).opal$ljust(width, "0");
            break;

          case 'z':
            var offset  = self.getTimezoneOffset(),
                hours   = Math.floor(Math.abs(offset) / 60),
                minutes = Math.abs(offset) % 60;

            result += offset < 0 ? "+" : "-";
            result += hours < 10 ? "0" : "";
            result += hours;

            if (colons > 0) {
              result += ":";
            }

            result += minutes < 10 ? "0" : "";
            result += minutes;

            if (colons > 1) {
              result += ":00";
            }

            break;

          case 'Z':
            result += self.opal$zone();
            break;

          case 'A':
            result += days_of_week[self.getDay()];
            break;

          case 'a':
            result += short_days[self.getDay()];
            break;

          case 'u':
            result += (self.getDay() + 1);
            break;

          case 'w':
            result += self.getDay();
            break;

          // TODO: week year
          // TODO: week number

          case 's':
            result += parseInt(self.getTime() / 1000)
            break;

          case 'n':
            result += "\n";
            break;

          case 't':
            result += "\t";
            break;

          case '%':
            result += "%";
            break;

          case 'c':
            result += self.opal$strftime("%a %b %e %T %Y");
            break;

          case 'D':
          case 'x':
            result += self.opal$strftime("%m/%d/%y");
            break;

          case 'F':
            result += self.opal$strftime("%Y-%m-%d");
            break;

          case 'v':
            result += self.opal$strftime("%e-%^b-%4Y");
            break;

          case 'r':
            result += self.opal$strftime("%I:%M:%S %p");
            break;

          case 'R':
            result += self.opal$strftime("%H:%M");
            break;

          case 'T':
          case 'X':
            result += self.opal$strftime("%H:%M:%S");
            break;

          default:
            return full;
        }

        if (upcase) {
          result = result.toUpperCase();
        }

        if (invert) {
          result = result.replace(/[A-Z]/, function(c) { c.toLowerCase() }).
                          replace(/[a-z]/, function(c) { c.toUpperCase() });
        }

        if (pad && (zero || blank)) {
          result = (result).opal$rjust(isNaN(width) ? 2 : width, blank ? " " : "0");
        }

        return result;
      });
    
    };

    def['opal$sunday?'] = function() {
      var self = this;

      return self.getDay() === 0;
    };

    def['opal$thursday?'] = function() {
      var self = this;

      return self.getDay() === 4;
    };

    def.opal$to_a = function() {
      var self = this;

      return [self.opal$sec(), self.opal$min(), self.opal$hour(), self.opal$day(), self.opal$month(), self.opal$year(), self.opal$wday(), self.opal$yday(), self.opal$isdst(), self.opal$zone()];
    };

    def.opal$to_f = function() {
      var self = this;

      return self.getTime() / 1000;
    };

    def.opal$to_i = function() {
      var self = this;

      return parseInt(self.getTime() / 1000);
    };

    opal$opal.defn(self, 'opal$to_s', def.opal$inspect);

    def['opal$tuesday?'] = function() {
      var self = this;

      return self.getDay() === 2;
    };

    opal$opal.defn(self, 'opal$utc?', def['opal$gmt?']);

    def.opal$utc_offset = function() {
      var self = this;

      return self.getTimezoneOffset() * -60;
    };

    def.opal$wday = function() {
      var self = this;

      return self.getDay();
    };

    def['opal$wednesday?'] = function() {
      var self = this;

      return self.getDay() === 3;
    };

    return (def.opal$year = function() {
      var self = this;

      return self.getFullYear();
    }, nil) && 'year';
  })(self, null);
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass;

  return (function(opal$base, opal$super) {
    function opal$Struct(){};
    var self = opal$Struct = opal$klass(opal$base, opal$super, 'Struct', opal$Struct);

    var def = self._proto, opal$scope = self._scope, TMP_1, TMP_8, TMP_10;

    opal$opal.defs(self, 'opal$new', TMP_1 = function(name, args) {var opal$zuper = opal$slice.call(arguments, 0);
      var opal$a, opal$b, opal$c, TMP_2, self = this, opal$iter = TMP_1._p, block = opal$iter || nil;

      args = opal$slice.call(arguments, 1);
      TMP_1._p = null;
      if (self['opal$=='](opal$scope.Struct)) {
        } else {
        return opal$opal.find_super_dispatcher(self, 'new', TMP_1, opal$iter, opal$Struct).apply(self, opal$zuper)
      };
      if (name['opal$[]'](0)['opal$=='](name['opal$[]'](0).opal$upcase())) {
        return opal$scope.Struct.opal$const_set(name, (opal$a = self).opal$new.apply(opal$a, [].concat(args)))
        } else {
        args.opal$unshift(name);
        return (opal$b = (opal$c = opal$scope.Class).opal$new, opal$b._p = (TMP_2 = function(){var self = TMP_2._s || this, opal$a, opal$b, TMP_3, opal$c;

        (opal$a = (opal$b = args).opal$each, opal$a._p = (TMP_3 = function(arg){var self = TMP_3._s || this;
if (arg == null) arg = nil;
          return self.opal$define_struct_attribute(arg)}, TMP_3._s = self, TMP_3), opal$a).call(opal$b);
          if (block !== false && block !== nil) {
            return (opal$a = (opal$c = self).opal$instance_eval, opal$a._p = block.opal$to_proc(), opal$a).call(opal$c)
            } else {
            return nil
          };}, TMP_2._s = self, TMP_2), opal$b).call(opal$c, self);
      };
    });

    opal$opal.defs(self, 'opal$define_struct_attribute', function(name) {
      var opal$a, opal$b, TMP_4, opal$c, TMP_5, self = this;

      if (self['opal$=='](opal$scope.Struct)) {
        self.opal$raise(opal$scope.ArgumentError, "you cannot define attributes to the Struct class")};
      self.opal$members()['opal$<<'](name);
      (opal$a = (opal$b = self).opal$define_method, opal$a._p = (TMP_4 = function(){var self = TMP_4._s || this;

      return self.opal$instance_variable_get("@" + (name))}, TMP_4._s = self, TMP_4), opal$a).call(opal$b, name);
      return (opal$a = (opal$c = self).opal$define_method, opal$a._p = (TMP_5 = function(value){var self = TMP_5._s || this;
if (value == null) value = nil;
      return self.opal$instance_variable_set("@" + (name), value)}, TMP_5._s = self, TMP_5), opal$a).call(opal$c, "" + (name) + "=");
    });

    opal$opal.defs(self, 'opal$members', function() {
      var opal$a, self = this;
      if (self.members == null) self.members = nil;

      if (self['opal$=='](opal$scope.Struct)) {
        self.opal$raise(opal$scope.ArgumentError, "the Struct class has no members")};
      return (((opal$a = self.members) !== false && opal$a !== nil) ? opal$a : self.members = []);
    });

    opal$opal.defs(self, 'opal$inherited', function(klass) {
      var opal$a, opal$b, TMP_6, self = this, members = nil;
      if (self.members == null) self.members = nil;

      if (self['opal$=='](opal$scope.Struct)) {
        return nil};
      members = self.members;
      return (opal$a = (opal$b = klass).opal$instance_eval, opal$a._p = (TMP_6 = function(){var self = TMP_6._s || this;

      return self.members = members}, TMP_6._s = self, TMP_6), opal$a).call(opal$b);
    });

    (function(self) {
      var opal$scope = self._scope, def = self._proto;

      return self._proto['opal$[]'] = self._proto.opal$new
    })(self.opal$singleton_class());

    self.opal$include(opal$scope.Enumerable);

    def.opal$initialize = function(args) {
      var opal$a, opal$b, TMP_7, self = this;

      args = opal$slice.call(arguments, 0);
      return (opal$a = (opal$b = self.opal$members()).opal$each_with_index, opal$a._p = (TMP_7 = function(name, index){var self = TMP_7._s || this;
if (name == null) name = nil;if (index == null) index = nil;
      return self.opal$instance_variable_set("@" + (name), args['opal$[]'](index))}, TMP_7._s = self, TMP_7), opal$a).call(opal$b);
    };

    def.opal$members = function() {
      var self = this;

      return self.opal$class().opal$members();
    };

    def['opal$[]'] = function(name) {
      var opal$a, self = this;

      if (((opal$a = opal$scope.Integer['opal$==='](name)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        if (name['opal$>='](self.opal$members().opal$size())) {
          self.opal$raise(opal$scope.IndexError, "offset " + (name) + " too large for struct(size:" + (self.opal$members().opal$size()) + ")")};
        name = self.opal$members()['opal$[]'](name);
      } else if (((opal$a = self.opal$members()['opal$include?'](name.opal$to_sym())) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.NameError, "no member '" + (name) + "' in struct")
      };
      return self.opal$instance_variable_get("@" + (name));
    };

    def['opal$[]='] = function(name, value) {
      var opal$a, self = this;

      if (((opal$a = opal$scope.Integer['opal$==='](name)) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        if (name['opal$>='](self.opal$members().opal$size())) {
          self.opal$raise(opal$scope.IndexError, "offset " + (name) + " too large for struct(size:" + (self.opal$members().opal$size()) + ")")};
        name = self.opal$members()['opal$[]'](name);
      } else if (((opal$a = self.opal$members()['opal$include?'](name.opal$to_sym())) !== nil && (!opal$a._isBoolean || opal$a == true))) {
        } else {
        self.opal$raise(opal$scope.NameError, "no member '" + (name) + "' in struct")
      };
      return self.opal$instance_variable_set("@" + (name), value);
    };

    def.opal$each = TMP_8 = function() {
      var opal$a, opal$b, TMP_9, self = this, opal$iter = TMP_8._p, opal$yield = opal$iter || nil;

      TMP_8._p = null;
      if ((opal$yield !== nil)) {
        } else {
        return self.opal$enum_for("each")
      };
      (opal$a = (opal$b = self.opal$members()).opal$each, opal$a._p = (TMP_9 = function(name){var self = TMP_9._s || this, opal$a;
if (name == null) name = nil;
      return opal$a = opal$opal.opal$yield1(opal$yield, self['opal$[]'](name)), opal$a === opal$breaker ? opal$a : opal$a}, TMP_9._s = self, TMP_9), opal$a).call(opal$b);
      return self;
    };

    def.opal$each_pair = TMP_10 = function() {
      var opal$a, opal$b, TMP_11, self = this, opal$iter = TMP_10._p, opal$yield = opal$iter || nil;

      TMP_10._p = null;
      if ((opal$yield !== nil)) {
        } else {
        return self.opal$enum_for("each_pair")
      };
      (opal$a = (opal$b = self.opal$members()).opal$each, opal$a._p = (TMP_11 = function(name){var self = TMP_11._s || this, opal$a;
if (name == null) name = nil;
      return opal$a = opal$opal.opal$yieldX(opal$yield, [name, self['opal$[]'](name)]), opal$a === opal$breaker ? opal$a : opal$a}, TMP_11._s = self, TMP_11), opal$a).call(opal$b);
      return self;
    };

    def['opal$eql?'] = function(other) {
      var opal$a, opal$b, opal$c, TMP_12, self = this;

      return (((opal$a = self.opal$hash()['opal$=='](other.opal$hash())) !== false && opal$a !== nil) ? opal$a : (opal$b = (opal$c = other.opal$each_with_index())['opal$all?'], opal$b._p = (TMP_12 = function(object, index){var self = TMP_12._s || this;
if (object == null) object = nil;if (index == null) index = nil;
      return self['opal$[]'](self.opal$members()['opal$[]'](index))['opal$=='](object)}, TMP_12._s = self, TMP_12), opal$b).call(opal$c));
    };

    def.opal$length = function() {
      var self = this;

      return self.opal$members().opal$length();
    };

    opal$opal.defn(self, 'opal$size', def.opal$length);

    def.opal$to_a = function() {
      var opal$a, opal$b, TMP_13, self = this;

      return (opal$a = (opal$b = self.opal$members()).opal$map, opal$a._p = (TMP_13 = function(name){var self = TMP_13._s || this;
if (name == null) name = nil;
      return self['opal$[]'](name)}, TMP_13._s = self, TMP_13), opal$a).call(opal$b);
    };

    opal$opal.defn(self, 'opal$values', def.opal$to_a);

    def.opal$inspect = function() {
      var opal$a, opal$b, TMP_14, self = this, result = nil;

      result = "#<struct ";
      if (self.opal$class()['opal$=='](opal$scope.Struct)) {
        result = result['opal$+']("" + (self.opal$class().opal$name()) + " ")};
      result = result['opal$+']((opal$a = (opal$b = self.opal$each_pair()).opal$map, opal$a._p = (TMP_14 = function(name, value){var self = TMP_14._s || this;
if (name == null) name = nil;if (value == null) value = nil;
      return "" + (name) + "=" + (value.opal$inspect())}, TMP_14._s = self, TMP_14), opal$a).call(opal$b).opal$join(", "));
      result = result['opal$+'](">");
      return result;
    };

    return opal$opal.defn(self, 'opal$to_s', def.opal$inspect);
  })(self, null)
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$klass = opal$opal.klass, opal$module = opal$opal.module, opal$gvars = opal$opal.gvars;
  if (opal$gvars.stdout == null) opal$gvars.stdout = nil;
  if (opal$gvars.stderr == null) opal$gvars.stderr = nil;

  (function(opal$base, opal$super) {
    function opal$IO(){};
    var self = opal$IO = opal$klass(opal$base, opal$super, 'IO', opal$IO);

    var def = self._proto, opal$scope = self._scope;

    opal$opal.cdecl(opal$scope, 'SEEK_SET', 0);

    opal$opal.cdecl(opal$scope, 'SEEK_CUR', 1);

    opal$opal.cdecl(opal$scope, 'SEEK_END', 2);

    (function(opal$base) {
      var self = opal$module(opal$base, 'Writable');

      var def = self._proto, opal$scope = self._scope;

      def['opal$<<'] = function(string) {
        var self = this;

        self.opal$write(string);
        return self;
      };

      def.opal$print = function(args) {
        var opal$a, opal$b, TMP_1, self = this;
        if (opal$gvars[","] == null) opal$gvars[","] = nil;

        args = opal$slice.call(arguments, 0);
        return self.opal$write((opal$a = (opal$b = args).opal$map, opal$a._p = (TMP_1 = function(arg){var self = TMP_1._s || this;
if (arg == null) arg = nil;
        return self.opal$String(arg)}, TMP_1._s = self, TMP_1), opal$a).call(opal$b).opal$join(opal$gvars[","]));
      };

      def.opal$puts = function(args) {
        var opal$a, opal$b, TMP_2, self = this;
        if (opal$gvars["/"] == null) opal$gvars["/"] = nil;

        args = opal$slice.call(arguments, 0);
        return self.opal$write((opal$a = (opal$b = args).opal$map, opal$a._p = (TMP_2 = function(arg){var self = TMP_2._s || this;
if (arg == null) arg = nil;
        return self.opal$String(arg)}, TMP_2._s = self, TMP_2), opal$a).call(opal$b).opal$join(opal$gvars["/"]));
      };
            ;opal$opal.donate(self, ["opal$<<", "opal$print", "opal$puts"]);
    })(self);

    return (function(opal$base) {
      var self = opal$module(opal$base, 'Readable');

      var def = self._proto, opal$scope = self._scope;

      def.opal$readbyte = function() {
        var self = this;

        return self.opal$getbyte();
      };

      def.opal$readchar = function() {
        var self = this;

        return self.opal$getc();
      };

      def.opal$readline = function(sep) {
        var self = this;
        if (opal$gvars["/"] == null) opal$gvars["/"] = nil;

        if (sep == null) {
          sep = opal$gvars["/"]
        }
        return self.opal$raise(opal$scope.NotImplementedError);
      };

      def.opal$readpartial = function(integer, outbuf) {
        var self = this;

        if (outbuf == null) {
          outbuf = nil
        }
        return self.opal$raise(opal$scope.NotImplementedError);
      };
            ;opal$opal.donate(self, ["opal$readbyte", "opal$readchar", "opal$readline", "opal$readpartial"]);
    })(self);
  })(self, null);
  opal$opal.cdecl(opal$scope, 'STDERR', opal$gvars.stderr = opal$scope.IO.opal$new());
  opal$opal.cdecl(opal$scope, 'STDIN', opal$gvars.stdin = opal$scope.IO.opal$new());
  opal$opal.cdecl(opal$scope, 'STDOUT', opal$gvars.stdout = opal$scope.IO.opal$new());
  opal$opal.defs(opal$gvars.stdout, 'opal$write', function(string) {
    var self = this;

    console.log(string.opal$to_s());;
    return nil;
  });
  opal$opal.defs(opal$gvars.stderr, 'opal$write', function(string) {
    var self = this;

    console.warn(string.opal$to_s());;
    return nil;
  });
  opal$gvars.stdout.opal$extend((opal$scope.IO)._scope.Writable);
  return opal$gvars.stderr.opal$extend((opal$scope.IO)._scope.Writable);
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice;

  opal$opal.defs(self, 'opal$to_s', function() {
    var self = this;

    return "main";
  });
  return (opal$opal.defs(self, 'opal$include', function(mod) {
    var self = this;

    return opal$scope.Object.opal$include(mod);
  }), nil) && 'include';
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice, opal$gvars = opal$opal.gvars, opal$hash2 = opal$opal.hash2;

  opal$gvars["&"] = opal$gvars["~"] = opal$gvars["`"] = opal$gvars["'"] = nil;
  opal$gvars[":"] = [];
  opal$gvars["\""] = [];
  opal$gvars["/"] = "\n";
  opal$gvars[","] = nil;
  opal$opal.cdecl(opal$scope, 'ARGV', []);
  opal$opal.cdecl(opal$scope, 'ARGF', opal$scope.Object.opal$new());
  opal$opal.cdecl(opal$scope, 'ENV', opal$hash2([], {}));
  opal$gvars.VERBOSE = false;
  opal$gvars.DEBUG = false;
  opal$gvars.SAFE = 0;
  opal$opal.cdecl(opal$scope, 'RUBY_PLATFORM', "opal");
  opal$opal.cdecl(opal$scope, 'RUBY_ENGINE', "opal");
  opal$opal.cdecl(opal$scope, 'RUBY_VERSION', "2.1.1");
  opal$opal.cdecl(opal$scope, 'RUBY_ENGINE_VERSION', "0.6.1");
  return opal$opal.cdecl(opal$scope, 'RUBY_RELEASE_DATE', "2014-04-15");
})(Opal);
/* Generated by Opal 0.6.2 */
(function(opal$opal) {
  var self = opal$opal.top, opal$scope = opal$opal, nil = opal$opal.nil, opal$breaker = opal$opal.breaker, opal$slice = opal$opal.slice;

  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  return true;
})(Opal);
